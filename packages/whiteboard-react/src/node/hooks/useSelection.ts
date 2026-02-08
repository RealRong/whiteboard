import { useCallback, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { Size } from 'types/common'
import type { SelectionMode, SelectionState } from 'types/state'
import type {
  SelectionHandlers,
  UseSelectionOptions,
  UseSelectionReturn,
  UseSelectionRuntimeReturn,
  UseSelectionStateReturn
} from 'types/node'
import { canvasNodesAtom, edgeSelectionAtom, nodeSelectionAtom, spacePressedAtom, toolAtom } from '../../common/state'
import {
  useInstance,
  useInstanceAtomValue,
  useWhiteboardConfig
} from '../../common/hooks'
import {
  getNodeRect,
  rectContainsRotatedRect,
  rectFromPoints,
  rectIntersectsRotatedRect
} from '../../common/utils/geometry'
import { getSelectionModeFromEvent } from '../utils/selection'

export const useSelectionState = (): UseSelectionStateReturn => {
  const state = useInstanceAtomValue(nodeSelectionAtom)
  const tool = useInstanceAtomValue(toolAtom)
  const selectedEdgeId = useInstanceAtomValue(edgeSelectionAtom)

  const isSelected = useCallback((id: NodeId) => state.selectedNodeIds.has(id), [state.selectedNodeIds])
  const hasSelection = useCallback(() => state.selectedNodeIds.size > 0, [state.selectedNodeIds])

  return useMemo(
    () => ({
      tool,
      selectedEdgeId,
      selectedNodeIds: state.selectedNodeIds,
      isSelecting: state.isSelecting,
      selectionRect: state.selectionRect,
      selectionRectWorld: state.selectionRectWorld,
      isSelected,
      hasSelection
    }),
    [
      hasSelection,
      isSelected,
      selectedEdgeId,
      state.isSelecting,
      state.selectedNodeIds,
      state.selectionRect,
      state.selectionRectWorld,
      tool
    ]
  )
}

export const useSelectionRuntime = (options: UseSelectionOptions = {}): UseSelectionRuntimeReturn => {
  const instance = useInstance()
  const { nodeSize: fallbackNodeSize } = useWhiteboardConfig()

  const startRef = useRef<Point | null>(null)
  const modeRef = useRef<SelectionMode>('replace')
  const rafRef = useRef<number | null>(null)
  const isSelectingRef = useRef(false)

  const minDragDistance = options.minDragDistance ?? 3
  const enabled = options.enabled ?? true
  const containerRef = options.containerRef ?? instance.runtime.containerRef ?? undefined
  const screenToWorld = options.screenToWorld ?? instance.runtime.viewport.screenToWorld ?? undefined
  const getNodes = useCallback(() => options.nodes ?? instance.state.get(canvasNodesAtom), [instance, options.nodes])
  const nodeSize = options.nodeSize ?? fallbackNodeSize
  const isSelectionToolEnabled = useCallback(() => {
    if (options.enabled === false) return false
    return instance.state.get(toolAtom) !== 'edge'
  }, [instance, options.enabled])

  const getModeFromEvent = useCallback(getSelectionModeFromEvent, [])
  const getClickModeFromEvent = getModeFromEvent

  const select = useCallback(
    (ids: NodeId[], mode: SelectionMode = 'replace') => {
      instance.commands.selection.select(ids, mode)
    },
    [instance]
  )

  const clear = useCallback(() => {
    instance.commands.selection.clear()
  }, [instance])

  const beginBox = useCallback(
    (pointScreen: Point, mode: SelectionMode = 'replace') => {
      startRef.current = pointScreen
      modeRef.current = mode
      instance.commands.selection.beginBox(mode)
    },
    [instance]
  )

  const hitTest = useCallback(
    (rectWorld: Rect, mode: SelectionMode) => {
      const nodes = getNodes()
      if (!nodes.length) return
      const matched: NodeId[] = []
      nodes.forEach((node) => {
        const nodeRect = getNodeRect(node, nodeSize as Size)
        const rotation = typeof node.rotation === 'number' ? node.rotation : 0
        const hit =
          node.type === 'group'
            ? rectContainsRotatedRect(rectWorld, nodeRect, rotation)
            : rectIntersectsRotatedRect(rectWorld, nodeRect, rotation)
        if (hit) matched.push(node.id)
      })
      select(matched, mode)
    },
    [getNodes, nodeSize, select]
  )

  const updateBox = useCallback(
    (pointScreen: Point) => {
      const start = startRef.current
      if (!start) return
      const rectScreen = rectFromPoints(start, pointScreen)
      let rectWorld: Rect | undefined
      if (screenToWorld) {
        const startWorld = screenToWorld({ x: rectScreen.x, y: rectScreen.y })
        const endWorld = screenToWorld({
          x: rectScreen.x + rectScreen.width,
          y: rectScreen.y + rectScreen.height
        })
        rectWorld = rectFromPoints(startWorld, endWorld)
      }
      isSelectingRef.current = true
      instance.commands.selection.updateBox(rectScreen, rectWorld)
      if (rectWorld) {
        if (rafRef.current !== null) return
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null
          hitTest(rectWorld as Rect, modeRef.current)
        })
      }
    },
    [hitTest, instance, screenToWorld]
  )

  const cancelPendingRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const endBox = useCallback(() => {
    startRef.current = null
    cancelPendingRaf()
    isSelectingRef.current = false
    instance.commands.selection.endBox()
  }, [cancelPendingRaf, instance])

  const handlers = useMemo(() => {
    if (!enabled) return undefined
    if (!containerRef || !screenToWorld) return undefined
    const container = containerRef

    const getScreenPoint = (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
      const element = container.current
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    }

    const isEventOnEmptyCanvas = (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
      const element = container.current
      if (!element) return false
      const target = event.target as HTMLElement
      if (!element.contains(target)) return false
      if (target.closest('[data-node-id]')) return false
      if (target.closest('[data-mindmap-node-id]')) return false
      if (target.closest('[data-selection-ignore]')) return false
      return true
    }

    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!isSelectionToolEnabled()) return
        if (event.button !== 0) return
        if (instance.state.get(spacePressedAtom)) return
        if (!isEventOnEmptyCanvas(event)) return
        const point = getScreenPoint(event)
        if (!point) return
        beginBox(point, getModeFromEvent('nativeEvent' in event ? event.nativeEvent : event))
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!startRef.current) return
        const point = getScreenPoint(event)
        if (!point) return
        const start = startRef.current
        const dx = Math.abs(point.x - start.x)
        const dy = Math.abs(point.y - start.y)
        if (!isSelectingRef.current && dx < minDragDistance && dy < minDragDistance) {
          return
        }
        event.preventDefault()
        updateBox(point)
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!startRef.current) return
        if (!isSelectingRef.current) {
          const mode = modeRef.current
          if (mode === 'replace') {
            clear()
          }
        }
        endBox()
      }
    }
  }, [
    beginBox,
    clear,
    containerRef,
    enabled,
    endBox,
    getModeFromEvent,
    isSelectionToolEnabled,
    minDragDistance,
    screenToWorld,
    instance,
    updateBox
  ])

  return useMemo(
    () => ({
      beginBox,
      updateBox,
      endBox,
      getModeFromEvent,
      getClickModeFromEvent,
      handlers,
      cancelPendingRaf
    }),
    [beginBox, cancelPendingRaf, endBox, getClickModeFromEvent, getModeFromEvent, handlers, updateBox]
  )
}

export const useSelection = (options: UseSelectionOptions = {}): UseSelectionReturn => {
  const instance = useInstance()
  const state = useSelectionState()
  const runtime = useSelectionRuntime(options)

  return useMemo(
    () => ({
      ...state,
      select: instance.commands.selection.select,
      toggle: instance.commands.selection.toggle,
      clear: instance.commands.selection.clear,
      ...runtime
    }),
    [instance, runtime, state]
  )
}

export const selection = {
  useState: useSelectionState,
  useRuntime: useSelectionRuntime,
  useSelection
}
