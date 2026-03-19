import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  createValueStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { useEffect, type RefObject } from 'react'
import { useStoreValue } from '../runtime/hooks'
import { GestureTuning } from '../runtime/interaction'
import type { InternalInstance } from '../runtime/instance'
import {
  filterNodeIds,
  leave
} from '../runtime/container'
import { createRafTask } from '../runtime/utils/rafTask'
import type { ViewportPointer } from '../runtime/viewport'
import { isBackgroundPointerTarget } from './target'

export type MarqueeMatch = 'touch' | 'contain'

export type MarqueePolicy = {
  match: MarqueeMatch
  exclude?: readonly NodeId[]
}

export type MarqueeStartInput = {
  pointerId: number
  capture: HTMLDivElement
  start: ViewportPointer
  mode: SelectionMode
  baseSelectedNodeIds: readonly NodeId[]
  containerNodeIds?: ReadonlySet<NodeId>
  policy: MarqueePolicy
  clearOnTap?: boolean
}

type ActiveMarquee = {
  pointerId: number
  mode: SelectionMode
  start: ViewportPointer
  baseSelectedNodeIds: Set<NodeId>
  containerNodeIds?: ReadonlySet<NodeId>
  latestMatchedIds?: NodeId[]
  selectedKey: string
  policy: MarqueePolicy
  clearOnTap: boolean
}

export type MarqueeSession = {
  rect: ReadStore<Rect | undefined>
  start: (input: MarqueeStartInput) => boolean
  handleBackgroundPointerDown: (
    container: HTMLDivElement,
    event: PointerEvent
  ) => void
  cancel: () => void
}

const toSelectionKey = (nodeIds: Iterable<NodeId>) => [...nodeIds].sort().join('|')

const isPointInRect = (point: { x: number; y: number }, rect: Rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

export const createMarqueeSession = (
  instance: InternalInstance
): MarqueeSession => {
  const rect = createValueStore<Rect | undefined>(undefined)
  let active: ActiveMarquee | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readMatchedNodeIds = (
    queryRect: Rect,
    containerNodeIds: ReadonlySet<NodeId> | undefined,
    policy: MarqueePolicy
  ) => {
    const matchedNodeIds = instance.read.index.node.idsInRect(queryRect, policy)
    return containerNodeIds
      ? matchedNodeIds.filter((nodeId) => containerNodeIds.has(nodeId))
      : matchedNodeIds
  }

  const flushSelection = () => {
    if (!active || active.latestMatchedIds === undefined) {
      return
    }

    const nextSelectedNodeIds = applySelection(
      active.baseSelectedNodeIds,
      active.latestMatchedIds,
      active.mode
    )
    const nextSelectedKey = toSelectionKey(nextSelectedNodeIds)
    if (nextSelectedKey === active.selectedKey) {
      return
    }

    active.selectedKey = nextSelectedKey
    instance.commands.selection.replace([...nextSelectedNodeIds])
  }

  const flushTask = createRafTask(flushSelection)

  const clear = () => {
    active = null
    session = null
    flushTask.cancel()
    rect.set(undefined)
  }

  const updateSelection = (
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    if (!active) {
      return false
    }

    const current = instance.viewport.pointer(input)
    const dx = Math.abs(current.screen.x - active.start.screen.x)
    const dy = Math.abs(current.screen.y - active.start.screen.y)

    if (
      active.latestMatchedIds === undefined
      && dx < GestureTuning.dragMinDistance
      && dy < GestureTuning.dragMinDistance
    ) {
      return false
    }

    active.latestMatchedIds = readMatchedNodeIds(
      rectFromPoints(active.start.world, current.world),
      active.containerNodeIds,
      active.policy
    )
    rect.set(rectFromPoints(active.start.screen, current.screen))
    flushTask.schedule()
    return true
  }

  const start = ({
    pointerId,
    capture,
    start,
    mode,
    baseSelectedNodeIds,
    containerNodeIds,
    policy,
    clearOnTap = false
  }: MarqueeStartInput) => {
    if (active || instance.interaction.mode.get() !== 'idle') {
      return false
    }

    const nextSession = instance.interaction.start({
      mode: 'marquee',
      pointerId,
      capture,
      pan: {
        frame: (pointer) => {
          if (!active || active.latestMatchedIds === undefined) {
            return
          }

          updateSelection(pointer)
        }
      },
      cleanup: clear,
      move: (moveEvent, interactionSession) => {
        if (updateSelection(moveEvent)) {
          interactionSession.pan(moveEvent)
        }
      },
      up: (upEvent, interactionSession) => {
        if (!active) {
          return
        }

        if (active.latestMatchedIds !== undefined) {
          const current = instance.viewport.pointer(upEvent)
          active.latestMatchedIds = readMatchedNodeIds(
            rectFromPoints(active.start.world, current.world),
            active.containerNodeIds,
            active.policy
          )
          flushSelection()
        } else if (active.clearOnTap && active.mode === 'replace') {
          instance.commands.selection.clear()
        }

        interactionSession.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    active = {
      pointerId,
      mode,
      start,
      baseSelectedNodeIds: new Set(baseSelectedNodeIds),
      containerNodeIds,
      selectedKey: toSelectionKey(baseSelectedNodeIds),
      policy,
      clearOnTap
    }
    session = nextSession
    rect.set(undefined)
    return true
  }

  const handleBackgroundPointerDown = (
    container: HTMLDivElement,
    event: PointerEvent
  ) => {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (active) return
    if (instance.interaction.mode.get() !== 'idle') return
    if (!instance.read.tool.is('select')) return

    const startPointer = instance.viewport.pointer(event)
    let activeContainer = instance.state.container.get()
    if (activeContainer.id) {
      const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
      const insideActiveContainer = Boolean(
        activeRect && isPointInRect(startPointer.world, activeRect)
      )

      if (!insideActiveContainer) {
        leave(instance)
        activeContainer = instance.state.container.get()
      }
    }

    if (!isBackgroundPointerTarget({
      target: event.target,
      currentTarget: container,
      activeContainerId: activeContainer.id
    })) {
      return
    }

    const selectedNodeIds = filterNodeIds(
      activeContainer,
      instance.state.selection.get().target.nodeIds
    )
    const containerNodeIds = activeContainer.id
      ? new Set<NodeId>(activeContainer.ids)
      : undefined

    const started = start({
      pointerId: event.pointerId,
      capture: container,
      start: startPointer,
      mode: resolveSelectionMode(event),
      baseSelectedNodeIds: selectedNodeIds,
      containerNodeIds,
      policy: {
        match: 'touch'
      },
      clearOnTap: true
    })
    if (!started) {
      return
    }

    if (instance.state.selection.get().target.edgeId !== undefined) {
      instance.commands.selection.clear()
    }

    event.preventDefault()
    event.stopPropagation()
  }

  return {
    rect,
    start,
    handleBackgroundPointerDown,
    cancel: () => {
      if (session) {
        session.cancel()
        return
      }
      clear()
    }
  }
}

export const Marquee = ({
  containerRef,
  marquee
}: {
  containerRef: RefObject<HTMLDivElement | null>
  marquee: MarqueeSession
}) => {
  const rect = useStoreValue(marquee.rect)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      marquee.handleBackgroundPointerDown(container, event)
    }

    container.addEventListener('pointerdown', onPointerDown)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
    }
  }, [containerRef, marquee])

  if (!rect) return null

  return (
    <div
      className="wb-marquee-layer"
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height
      }}
    />
  )
}
