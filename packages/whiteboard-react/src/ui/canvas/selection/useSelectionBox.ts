import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import { filterContainerNodeIds } from '../../../runtime/state/container'
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
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)
  const mountedRef = useRef(true)
  const [selectionBox, setSelectionBox] = useState<Rect | undefined>(undefined)

  const writeSelectionBox = useCallback((next: Rect | undefined) => {
    if (!mountedRef.current) {
      return
    }
    setSelectionBox(next)
  }, [])

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
    writeSelectionBox(
      rectFromPoints(active.start.screen, current.screen)
    )
    flushTaskRef.current.schedule()
    return true
  }, [instance, readMatchedNodeIds, writeSelectionBox])

  const clear = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    flushTaskRef.current.cancel()
    writeSelectionBox(undefined)
  }, [writeSelectionBox])

  const cancel = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clear()
  }, [clear])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (activeRef.current) return
      if (instance.interaction.mode.get() !== 'idle') return
      if (instance.state.tool.get() === 'edge') return

      const start = instance.viewport.pointer(event)
      let activeContainer = instance.state.container.get()
      if (activeContainer.id) {
        const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
        const insideActiveContainer = Boolean(
          activeRect && isPointInRect(start.world, activeRect)
        )

        if (!insideActiveContainer) {
          instance.commands.selection.clear()
          instance.commands.container.exit()
          activeContainer = instance.state.container.get()
        }
      }

      if (!isBackgroundPointerTarget(event.target, container, activeContainer.id)) {
        return
      }

      const nextSession = instance.interaction.start({
        mode: 'selection-box',
        pointerId: event.pointerId,
        capture: container,
        pan: {
          frame: (pointer) => {
            const active = activeRef.current
            if (!active || active.latestMatchedIds === undefined) {
              return
            }

            const current = instance.viewport.pointer(pointer)
            active.latestMatchedIds = readMatchedNodeIds(
              rectFromPoints(active.start.world, current.world),
              active.containerNodeIds
            )
            writeSelectionBox(
              rectFromPoints(active.start.screen, current.screen)
            )
            flushTaskRef.current.schedule()
          }
        },
        cleanup: clear,
        move: (event, session) => {
          if (updateSelection(event)) {
            session.pan(event)
          }
        },
        up: (event, session) => {
          const active = activeRef.current
          if (!active) {
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

          session.finish()
        }
      })
      if (!nextSession) return

      const selectedNodeIds = filterContainerNodeIds(
        activeContainer,
        instance.state.selection.get().target.nodeIds
      )
      const containerNodeIds = activeContainer.id
        ? new Set<NodeId>(activeContainer.ids)
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
      sessionRef.current = nextSession
      writeSelectionBox(undefined)

      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('pointerdown', onPointerDown)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
    }
  }, [
    clear,
    containerRef,
    flushSelection,
    instance,
    readMatchedNodeIds,
    updateSelection,
    writeSelectionBox
  ])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      cancel()
    }
  }, [cancel])

  return selectionBox
}
