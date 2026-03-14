import { useCallback, useMemo, useRef, useState } from 'react'
import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import { useInternalInstance } from '../common/hooks'
import { interactionLock, type InteractionLockToken } from '../common/interaction/interactionLock'
import { useWindowPointerSession } from '../common/interaction/useWindowPointerSession'
import { createRafTask } from '../common/utils/rafTask'
import { useInteractionView } from '../interaction/view'

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
  scopeNodeIds?: ReadonlySet<NodeId>
  latestMatchedIds?: NodeId[]
  selectedKey: string
}

const BACKGROUND_CONTENT_IGNORE_SELECTOR = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  '[data-input-role]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

const BACKGROUND_ENTITY_SELECTOR = [
  '[data-node-id]',
  '[data-edge-id]'
].join(', ')

const toSelectionKey = (nodeIds: Iterable<NodeId>) => [...nodeIds].sort().join('|')

const isBackgroundPointerTarget = (
  target: EventTarget | null,
  currentTarget: EventTarget & HTMLDivElement,
  activeContainerId?: NodeId
) => (
  target instanceof Element
  && currentTarget.contains(target)
  && !target.closest(BACKGROUND_CONTENT_IGNORE_SELECTOR)
  && (() => {
    const entity = target.closest(BACKGROUND_ENTITY_SELECTOR)
    if (!entity) return true
    if (entity.hasAttribute('data-edge-id')) return false
    return activeContainerId !== undefined
      && entity.getAttribute('data-node-id') === activeContainerId
  })()
)

const readPointerPosition = (
  instance: ReturnType<typeof useInternalInstance>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): PointerPosition => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return {
    screen,
    world: instance.viewport.screenToWorld(screen)
  }
}

const isPointInRect = (point: Point, rect: Rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

export const useSelectionBoxInteraction = () => {
  const instance = useInternalInstance()
  const selection = instance.draft.selection
  const interaction = useInteractionView()
  const activeRef = useRef<ActiveSelection | null>(null)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const readMatchedNodeIds = useCallback((rect: Rect, scopeNodeIds?: ReadonlySet<NodeId>) => {
    const matchedNodeIds = instance.read.index.node.idsInRect(rect)
    return scopeNodeIds
      ? matchedNodeIds.filter((nodeId) => scopeNodeIds.has(nodeId))
      : matchedNodeIds
  }, [instance])

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
    instance.commands.session.end()
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

      active.latestMatchedIds = readMatchedNodeIds(
        rectFromPoints(active.start.world, current.world),
        active.scopeNodeIds
      )
      selection.write(rectFromPoints(active.start.screen, current.screen))
      flushTask.schedule()
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      if (active.latestMatchedIds !== undefined) {
        const current = readPointerPosition(instance, event)
        active.latestMatchedIds = readMatchedNodeIds(
          rectFromPoints(active.start.world, current.world),
          active.scopeNodeIds
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
      if (!interaction.canCanvasSelect) return
      if (instance.state.tool.get() === 'edge') return

      const start = readPointerPosition(instance, event)
      let activeContainerId = instance.read.container.activeId()
      if (activeContainerId) {
        const activeRect = instance.read.container.activeRect()
        const insideActiveContainer = Boolean(
          activeRect && isPointInRect(start.world, activeRect)
        )

        if (!insideActiveContainer) {
          instance.commands.selection.clear()
          instance.commands.container.exit()
          activeContainerId = undefined
        }
      }

      if (!isBackgroundPointerTarget(
        event.target,
        container,
        activeContainerId
      )) return

      const lockToken = interactionLock.tryAcquire(instance, 'selectionBox', event.pointerId)
      if (!lockToken) return

      const selectedNodeIds = instance.read.container.filterNodeIds(
        instance.state.selection.getNodeIds()
      )
      const scopeNodeIds = activeContainerId
        ? new Set(instance.read.container.nodeIds())
        : undefined

      instance.commands.selection.selectEdge(undefined)
      activeRef.current = {
        lockToken,
        pointerId: event.pointerId,
        mode: resolveSelectionMode(event),
        start,
        baseSelectedNodeIds: new Set(selectedNodeIds),
        scopeNodeIds,
        selectedKey: toSelectionKey(selectedNodeIds)
      }
      setActivePointerId(event.pointerId)
      instance.commands.session.beginSelectionBox()
      selection.clear()

      try {
        container.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }

      event.preventDefault()
      event.stopPropagation()
    },
    [instance, interaction, selection]
  )

  return {
    cancelSelectionSession,
    handleContainerPointerDown
  }
}
