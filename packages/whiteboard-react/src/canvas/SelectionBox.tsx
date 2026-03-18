import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { useEffect, useState, type RefObject } from 'react'
import { useInternalInstance } from '../runtime/hooks'
import {
  filterNodeIds,
  leave
} from '../runtime/container'
import { createRafTask } from '../runtime/utils/rafTask'
import type { ViewportPointer } from '../runtime/viewport'
import { isBackgroundPointerTarget } from './target'

type ActiveSelection = {
  pointerId: number
  mode: SelectionMode
  start: ViewportPointer
  baseSelectedNodeIds: Set<NodeId>
  containerNodeIds?: ReadonlySet<NodeId>
  latestMatchedIds?: NodeId[]
  selectedKey: string
}

const toSelectionKey = (nodeIds: Iterable<NodeId>) => [...nodeIds].sort().join('|')

const isPointInRect = (point: { x: number; y: number }, rect: Rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

export const SelectionBox = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const [selectionBox, setSelectionBox] = useState<Rect | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let active: ActiveSelection | null = null
    let session: ReturnType<typeof instance.interaction.start> = null

    const readMatchedNodeIds = (
      rect: Rect,
      containerNodeIds?: ReadonlySet<NodeId>
    ) => {
      const matchedNodeIds = instance.read.index.node.idsInRect(rect)
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
      setSelectionBox(undefined)
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

      const minDragDistance = instance.config.node.selectionMinDragDistance
      const current = instance.viewport.pointer(input)
      const dx = Math.abs(current.screen.x - active.start.screen.x)
      const dy = Math.abs(current.screen.y - active.start.screen.y)

      if (
        active.latestMatchedIds === undefined
        && dx < minDragDistance
        && dy < minDragDistance
      ) {
        return false
      }

      active.latestMatchedIds = readMatchedNodeIds(
        rectFromPoints(active.start.world, current.world),
        active.containerNodeIds
      )
      setSelectionBox(rectFromPoints(active.start.screen, current.screen))
      flushTask.schedule()
      return true
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (active) return
      if (instance.interaction.mode.get() !== 'idle') return
      if (!instance.read.tool.is('select')) return

      const start = instance.viewport.pointer(event)
      let activeContainer = instance.state.container.get()
      if (activeContainer.id) {
        const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
        const insideActiveContainer = Boolean(
          activeRect && isPointInRect(start.world, activeRect)
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

      const nextSession = instance.interaction.start({
        mode: 'selection-box',
        pointerId: event.pointerId,
        capture: container,
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
              active.containerNodeIds
            )
            flushSelection()
          } else if (active.mode === 'replace') {
            instance.commands.selection.clear()
          }

          interactionSession.finish()
        }
      })
      if (!nextSession) return

      const selectedNodeIds = filterNodeIds(
        activeContainer,
        instance.state.selection.get().target.nodeIds
      )
      const containerNodeIds = activeContainer.id
        ? new Set<NodeId>(activeContainer.ids)
        : undefined

      if (instance.state.selection.get().target.edgeId !== undefined) {
        instance.commands.selection.clear()
      }
      active = {
        pointerId: event.pointerId,
        mode: resolveSelectionMode(event),
        start,
        baseSelectedNodeIds: new Set(selectedNodeIds),
        containerNodeIds,
        selectedKey: toSelectionKey(selectedNodeIds)
      }
      session = nextSession
      setSelectionBox(undefined)

      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('pointerdown', onPointerDown)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
      if (session) {
        session.cancel()
        return
      }
      active = null
      flushTask.cancel()
    }
  }, [containerRef, instance])

  if (!selectionBox) return null

  return (
    <div
      className="wb-selection-layer"
      style={{
        transform: `translate(${selectionBox.x}px, ${selectionBox.y}px)`,
        width: selectionBox.width,
        height: selectionBox.height
      }}
    />
  )
}
