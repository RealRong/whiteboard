import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  createDerivedStore,
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
import { readContainerBodyTarget } from '../features/node/scene'
import { matchNodeIdsInRect } from '../features/node/selection'
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
  capture: Element
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

type ContainerBodyPressHandler = (
  nodeId: NodeId,
  container: HTMLDivElement,
  event: PointerEvent
) => boolean

const toSelectionKey = (nodeIds: Iterable<NodeId>) => [...nodeIds].sort().join('|')

const isPointInRect = (point: { x: number; y: number }, rect: Rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

const projectWorldRect = (
  instance: InternalInstance,
  worldRect: Rect
): Rect => {
  const topLeft = instance.viewport.worldToScreen({
    x: worldRect.x,
    y: worldRect.y
  })
  const bottomRight = instance.viewport.worldToScreen({
    x: worldRect.x + worldRect.width,
    y: worldRect.y + worldRect.height
  })

  return rectFromPoints(topLeft, bottomRight)
}

export const createMarqueeSession = (
  instance: InternalInstance,
  {
    getContainerBodyPress
  }: {
    getContainerBodyPress?: () => ContainerBodyPressHandler | null
  } = {}
): MarqueeSession => {
  const worldRect = createValueStore<Rect | undefined>(undefined)
  const rect = createDerivedStore<Rect | undefined>({
    get: (read) => {
      const nextWorldRect = read(worldRect)
      read(instance.viewport)
      if (!nextWorldRect) {
        return undefined
      }
      return projectWorldRect(instance, nextWorldRect)
    },
    isEqual: (left, right) => (
      left === right
      || (
        left?.x === right?.x
        && left?.y === right?.y
        && left?.width === right?.width
        && left?.height === right?.height
      )
    )
  })
  let active: ActiveMarquee | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readMatchedNodeIds = (
    queryRect: Rect,
    containerNodeIds: ReadonlySet<NodeId> | undefined,
    policy: MarqueePolicy
  ) => {
    const matchedNodeIds = matchNodeIdsInRect(instance, queryRect, policy)
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
    worldRect.set(undefined)
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
    worldRect.set(rectFromPoints(active.start.world, current.world))
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
    worldRect.set(undefined)
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

    if (!activeContainer.id) {
      const containerNodeId = readContainerBodyTarget(instance, startPointer.world)
      if (containerNodeId) {
        if (getContainerBodyPress?.()?.(containerNodeId, container, event)) {
          return
        }
        const currentSelectedNodeIds = instance.read.selection.get().target.nodeIds
        const nextSelectedNodeIds = [
          ...applySelection(
            new Set(currentSelectedNodeIds),
            [containerNodeId],
            resolveSelectionMode(event)
          )
        ]
        instance.commands.selection.replace(nextSelectedNodeIds)
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }

    const selectedNodeIds = filterNodeIds(
      activeContainer,
      instance.read.selection.get().target.nodeIds
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

    if (instance.read.selection.get().target.edgeId !== undefined) {
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
