import { rectFromPoints } from '@whiteboard/core/geometry'
import { createValueStore } from '@whiteboard/core/runtime'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useInternalInstance, useView } from '../../../runtime/hooks'
import {
  createPanDriver,
  useWindowPointerSession
} from '../../../runtime/interaction'
import { createRafTask } from '../../../runtime/utils/rafTask'
import type { ViewportPointer } from '../../../runtime/viewport'

type ActiveSelection = {
  pointerId: number
  mode: SelectionMode
  start: ViewportPointer
  baseSelectedNodeIds: Set<NodeId>
  containerNodeIds?: ReadonlySet<NodeId>
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

const isPointInRect = (point: { x: number; y: number }, rect: Rect) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

export const useSelectionBox = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveSelection | null>(null)
  const tokenRef = useRef<ReturnType<typeof instance.interaction.tryStart> | null>(null)
  const pointerRef = useRef(createValueStore<number | null>(null))
  const panRef = useRef<ReturnType<typeof createPanDriver> | null>(null)

  if (!panRef.current) {
    panRef.current = createPanDriver({
      viewport: instance.viewport,
      enabled: () => instance.interaction.current()?.mode === 'selection-box',
      onFrame: (pointer) => {
        const active = activeRef.current
        if (!active || active.latestMatchedIds === undefined) {
          return
        }

        const current = instance.viewport.pointer(pointer)
        active.latestMatchedIds = readMatchedNodeIds(
          rectFromPoints(active.start.world, current.world),
          active.containerNodeIds
        )
        instance.draft.selection.write(
          rectFromPoints(active.start.screen, current.screen)
        )
        flushTaskRef.current.schedule()
      }
    })
  }

  const flushSelection = useCallback(() => {
    const active = activeRef.current
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
    instance.commands.selection.select([...nextSelectedNodeIds], 'replace')
  }, [instance])

  const flushTaskRef = useRef(createRafTask(flushSelection))
  const readMatchedNodeIds = useCallback((
    rect: Rect,
    containerNodeIds?: ReadonlySet<NodeId>
  ) => {
    const matchedNodeIds = instance.read.index.node.idsInRect(rect)
    return containerNodeIds
      ? matchedNodeIds.filter((nodeId) => containerNodeIds.has(nodeId))
      : matchedNodeIds
  }, [instance])
  const updateSelection = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = activeRef.current
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
    instance.draft.selection.write(rectFromPoints(active.start.screen, current.screen))
    flushTaskRef.current.schedule()
    return true
  }, [instance, readMatchedNodeIds])

  const cancel = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (pointerId !== undefined && active && active.pointerId !== pointerId) {
      return
    }

    const token = tokenRef.current
    activeRef.current = null
    tokenRef.current = null
    panRef.current?.stop()
    flushTaskRef.current.cancel()
    pointerRef.current.set(null)
    instance.draft.selection.clear()

    if (token) {
      instance.interaction.finish(token)
    }
  }, [instance])

  const pointerId = useView(pointerRef.current)

  useWindowPointerSession({
    pointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      if (updateSelection(event)) {
        panRef.current?.update(event)
      }
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      if (active.latestMatchedIds !== undefined) {
        const current = instance.viewport.pointer(event)
        active.latestMatchedIds = readMatchedNodeIds(
          rectFromPoints(active.start.world, current.world),
          active.containerNodeIds
        )
        flushSelection()
      } else if (active.mode === 'replace') {
        instance.commands.selection.clear()
      }

      cancel(active.pointerId)
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      cancel(active.pointerId)
    },
    onBlur: () => {
      cancel()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') {
        return
      }

      cancel()
    }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (pointerRef.current.get() !== null) return
      if (instance.interaction.mode.get() !== 'idle') return
      if (instance.view.tool.get() === 'edge') return

      const start = instance.viewport.pointer(event)
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

      if (!isBackgroundPointerTarget(event.target, container, activeContainerId)) {
        return
      }

      const token = instance.interaction.tryStart({
        mode: 'selection-box',
        cancel: () => cancel(event.pointerId),
        pointerId: event.pointerId
      })
      if (!token) return

      const selectedNodeIds = instance.read.container.filterNodeIds(
        instance.read.selection.nodeIds()
      )
      const containerNodeIds = activeContainerId
        ? new Set<NodeId>(instance.read.container.nodeIds())
        : undefined

      instance.commands.selection.selectEdge(undefined)
      activeRef.current = {
        pointerId: event.pointerId,
        mode: resolveSelectionMode(event),
        start,
        baseSelectedNodeIds: new Set(selectedNodeIds),
        containerNodeIds,
        selectedKey: toSelectionKey(selectedNodeIds)
      }
      tokenRef.current = token
      pointerRef.current.set(event.pointerId)
      instance.draft.selection.clear()

      try {
        container.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }

      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('pointerdown', onPointerDown)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
    }
  }, [cancel, containerRef, instance])

  useEffect(() => () => {
    const active = activeRef.current
    cancel(active?.pointerId)
  }, [cancel])
}
