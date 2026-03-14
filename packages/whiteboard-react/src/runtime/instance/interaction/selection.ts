import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import { interactionLock, type InteractionLockToken } from '../../interaction/interactionLock'
import { createRafTask } from '../../utils/rafTask'
import type { InternalWhiteboardInstance } from '../types'
import { createSignal } from './signal'
import type {
  ActiveInteractionSessionKind,
  InteractionSession,
  SelectionInteractionRuntime
} from './types'

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
  instance: InternalWhiteboardInstance,
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

export const createSelectionInteractionRuntime = (
  getInstance: () => InternalWhiteboardInstance,
  lifecycle: {
    begin: (kind: ActiveInteractionSessionKind) => void
    end: () => void
  }
): SelectionInteractionRuntime => {
  let active: ActiveSelection | null = null
  const pointer = createSignal<number | null>(null)

  const readMatchedNodeIds = (rect: Rect, scopeNodeIds?: ReadonlySet<NodeId>) => {
    const instance = getInstance()
    const matchedNodeIds = instance.read.index.node.idsInRect(rect)
    return scopeNodeIds
      ? matchedNodeIds.filter((nodeId) => scopeNodeIds.has(nodeId))
      : matchedNodeIds
  }

  const flushSelection = () => {
    const instance = getInstance()
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
  }

  const flushTask = createRafTask(flushSelection)

  const cancel = (pointerId?: number) => {
    const instance = getInstance()
    if (pointerId !== undefined && active && active.pointerId !== pointerId) return

    const previous = active
    flushTask.cancel()

    active = null
    pointer.set(null)
    instance.draft.selection.clear()
    lifecycle.end()
    if (!previous) return
    interactionLock.release(instance, previous.lockToken)
  }

  return {
    pointer,
    cancel,
    handleContainerPointerDown: (event, container) => {
      const instance = getInstance()
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (active) return
      if (!instance.view.interaction.get().canCanvasSelect) return
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

      if (!isBackgroundPointerTarget(event.target, container, activeContainerId)) return

      const lockToken = interactionLock.tryAcquire(instance, 'selectionBox', event.pointerId)
      if (!lockToken) return

      const selectedNodeIds = instance.read.container.filterNodeIds(
        instance.state.selection.getNodeIds()
      )
      const scopeNodeIds = activeContainerId
        ? new Set<NodeId>(instance.read.container.nodeIds())
        : undefined

      instance.commands.selection.selectEdge(undefined)
      active = {
        lockToken,
        pointerId: event.pointerId,
        mode: resolveSelectionMode(event),
        start,
        baseSelectedNodeIds: new Set(selectedNodeIds),
        scopeNodeIds,
        selectedKey: toSelectionKey(selectedNodeIds)
      }
      pointer.set(event.pointerId)
      lifecycle.begin('selection-box')
      instance.draft.selection.clear()

      try {
        container.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }

      event.preventDefault()
      event.stopPropagation()
    },
    onWindowPointerMove: (event) => {
      const instance = getInstance()
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
      instance.draft.selection.write(rectFromPoints(active.start.screen, current.screen))
      flushTask.schedule()
    },
    onWindowPointerUp: (event) => {
      const instance = getInstance()
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

      cancel(active.pointerId)
    },
    onWindowPointerCancel: (event) => {
      if (!active || event.pointerId !== active.pointerId) return
      cancel(active.pointerId)
    },
    onWindowBlur: () => {
      cancel()
    },
    onWindowKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancel()
    }
  }
}
