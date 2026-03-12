import { useCallback, useMemo, useRef, useState } from 'react'
import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../common/instance'
import { interactionLock, type InteractionLockToken } from '../common/interaction/interactionLock'
import { useWindowPointerSession } from '../common/interaction/useWindowPointerSession'
import { createRafTask } from '../common/utils/rafTask'
import type { SelectionWriter } from '../transient'

type PointerPosition = {
  screen: Point
  world: Point
}

type ActiveSelection = {
  lockToken: InteractionLockToken
  pointerId: number
  mode: SelectionMode
  start: PointerPosition
  baseSelectedNodeIds: Set<NodeId>
  latestMatchedIds?: NodeId[]
  selectedKey: string
}

const BACKGROUND_IGNORE_SELECTOR = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  '[data-input-role]',
  '[data-node-id]',
  '[data-edge-id]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

const toSelectionKey = (nodeIds: Iterable<NodeId>) => [...nodeIds].sort().join('|')

const isBackgroundPointerTarget = (
  target: EventTarget | null,
  currentTarget: EventTarget & HTMLDivElement
) => (
  target instanceof Element
  && currentTarget.contains(target)
  && !target.closest(BACKGROUND_IGNORE_SELECTOR)
)

const readPointerPosition = (
  instance: InternalWhiteboardInstance,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): PointerPosition => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return {
    screen,
    world: instance.viewport.screenToWorld(screen)
  }
}

export const useSelectionBoxInteraction = (
  instance: InternalWhiteboardInstance,
  selection: SelectionWriter
) => {
  const activeRef = useRef<ActiveSelection | null>(null)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)

  const flushSelection = useCallback(() => {
    const active = activeRef.current
    if (!active || active.latestMatchedIds === undefined) return
    const nextSelectedNodeIds = applySelection(
      active.baseSelectedNodeIds,
      active.latestMatchedIds,
      active.mode
    )
    const nextSelectedKey = toSelectionKey(nextSelectedNodeIds)
    if (nextSelectedKey === active.selectedKey) return
    active.selectedKey = nextSelectedKey
    instance.commands.selection.select([...nextSelectedNodeIds], 'replace')
  }, [instance])

  const flushTask = useMemo(
    () => createRafTask(flushSelection),
    [flushSelection]
  )

  const cancelSelectionSession = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.pointerId !== pointerId) return

    flushTask.cancel()

    activeRef.current = null
    setActivePointerId(null)
    selection.clear()
    if (!active) return
    interactionLock.release(instance, active.lockToken)
  }, [flushTask, instance, selection])

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      const minDragDistance = instance.config.node.selectionMinDragDistance
      const current = readPointerPosition(instance, event)
      const dx = Math.abs(current.screen.x - active.start.screen.x)
      const dy = Math.abs(current.screen.y - active.start.screen.y)
      if (active.latestMatchedIds === undefined && dx < minDragDistance && dy < minDragDistance) {
        return
      }

      active.latestMatchedIds = instance.read.index.node.idsInRect(
        rectFromPoints(active.start.world, current.world)
      )
      selection.write(rectFromPoints(active.start.screen, current.screen))
      flushTask.schedule()
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      if (active.latestMatchedIds !== undefined) {
        const current = readPointerPosition(instance, event)
        active.latestMatchedIds = instance.read.index.node.idsInRect(
          rectFromPoints(active.start.world, current.world)
        )
        flushSelection()
      } else if (active.mode === 'replace') {
        instance.commands.selection.clear()
      }

      cancelSelectionSession(active.pointerId)
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return
      cancelSelectionSession(active.pointerId)
    },
    onBlur: () => {
      cancelSelectionSession()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancelSelectionSession()
    }
  })

  const handleContainerPointerDown = useCallback(
    (event: PointerEvent, container: HTMLDivElement) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.state.tool() === 'edge') return
      if (!isBackgroundPointerTarget(event.target, container)) return

      const lockToken = interactionLock.tryAcquire(instance, 'selectionBox', event.pointerId)
      if (!lockToken) return

      const selectedNodeIds = instance.state.selectedNodeIds()
      const start = readPointerPosition(instance, event)

      instance.commands.selection.selectEdge(undefined)
      activeRef.current = {
        lockToken,
        pointerId: event.pointerId,
        mode: resolveSelectionMode(event),
        start,
        baseSelectedNodeIds: new Set(selectedNodeIds),
        selectedKey: toSelectionKey(selectedNodeIds)
      }
      setActivePointerId(event.pointerId)
      selection.clear()

      try {
        container.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }

      event.preventDefault()
      event.stopPropagation()
    },
    [instance, selection]
  )

  return {
    cancelSelectionSession,
    handleContainerPointerDown
  }
}
