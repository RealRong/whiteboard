import { useCallback, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { NodeId, Point, Rect } from '@whiteboard/core'
import type { SelectionMode } from 'types/state'
import type {
  SelectionHandlers,
  UseSelectionOptions,
  UseSelectionReturn,
  UseSelectionRuntimeReturn,
  UseSelectionStateReturn
} from 'types/node'
import {
  useInstance,
  useWhiteboardSelector
} from '../../common/hooks'
import { rectFromPoints } from '../../common/utils/geometry'
import { getSelectionModeFromEvent } from '../utils/selection'

export const useSelectionState = (): UseSelectionStateReturn => {
  const state = useWhiteboardSelector('selection')
  const tool = useWhiteboardSelector('tool')
  const selectedEdgeId = useWhiteboardSelector('edgeSelection')

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

  const startRef = useRef<Point | null>(null)
  const modeRef = useRef<SelectionMode>('replace')
  const rafRef = useRef<number | null>(null)
  const isSelectingRef = useRef(false)

  const minDragDistance = options.minDragDistance ?? 3
  const enabled = options.enabled ?? true
  const containerRef = instance.runtime.containerRef
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const isSelectionToolEnabled = useCallback(() => {
    if (!enabled) return false
    return instance.state.read('tool') !== 'edge'
  }, [enabled, instance])

  const getModeFromEvent = useCallback(getSelectionModeFromEvent, [])

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
      const matched = instance.query.getNodeIdsInRect(rectWorld)
      if (!matched.length) return
      select(matched, mode)
    },
    [instance.query, select]
  )

  const updateBox = useCallback(
    (pointScreen: Point) => {
      const start = startRef.current
      if (!start) return
      const rectScreen = rectFromPoints(start, pointScreen)
      const startWorld = screenToWorld({ x: rectScreen.x, y: rectScreen.y })
      const endWorld = screenToWorld({
        x: rectScreen.x + rectScreen.width,
        y: rectScreen.y + rectScreen.height
      })
      const rectWorld = rectFromPoints(startWorld, endWorld)
      isSelectingRef.current = true
      instance.commands.selection.updateBox(rectScreen, rectWorld)
      if (rafRef.current !== null) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        hitTest(rectWorld, modeRef.current)
      })
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
    const container = containerRef

    const getScreenPoint = (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
      const element = container.current
      if (!element) return null
      return clientToScreen(event.clientX, event.clientY)
    }

    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!isSelectionToolEnabled()) return
        if (event.button !== 0) return
        if (instance.state.read('spacePressed')) return
        if (!instance.query.isCanvasBackgroundTarget(event.target)) return
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
    clientToScreen,
    instance,
    updateBox
  ])

  return useMemo(
    () => ({
      beginBox,
      updateBox,
      endBox,
      getModeFromEvent,
      handlers,
      cancelPendingRaf
    }),
    [beginBox, cancelPendingRaf, endBox, getModeFromEvent, handlers, updateBox]
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
