import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  const { selection, tool, selectedEdgeId } = useWhiteboardSelector(
    (snapshot) => ({
      selection: snapshot.selection,
      tool: snapshot.tool,
      selectedEdgeId: snapshot.edgeSelection
    }),
    {
      keys: ['selection', 'tool', 'edgeSelection']
    }
  )

  const isSelected = useCallback((id: NodeId) => selection.selectedNodeIds.has(id), [selection.selectedNodeIds])
  const hasSelection = useCallback(() => selection.selectedNodeIds.size > 0, [selection.selectedNodeIds])

  return useMemo(
    () => ({
      tool,
      selectedEdgeId,
      selectedNodeIds: selection.selectedNodeIds,
      isSelecting: selection.isSelecting,
      selectionRect: selection.selectionRect,
      selectionRectWorld: selection.selectionRectWorld,
      isSelected,
      hasSelection
    }),
    [
      hasSelection,
      isSelected,
      selectedEdgeId,
      selection.isSelecting,
      selection.selectedNodeIds,
      selection.selectionRect,
      selection.selectionRectWorld,
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
  const latestRectWorldRef = useRef<Rect | null>(null)
  const activePointerIdRef = useRef<number | null>(null)

  const minDragDistance = options.minDragDistance ?? instance.runtime.config.node.selectionMinDragDistance
  const enabled = options.enabled ?? true

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
      latestRectWorldRef.current = null
      isSelectingRef.current = false
      activePointerIdRef.current = null
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
    [instance, select]
  )

  const updateBox = useCallback(
    (pointScreen: Point) => {
      const start = startRef.current
      if (!start) return

      const rectScreen = rectFromPoints(start, pointScreen)
      const startWorld = instance.runtime.viewport.screenToWorld({
        x: rectScreen.x,
        y: rectScreen.y
      })
      const endWorld = instance.runtime.viewport.screenToWorld({
        x: rectScreen.x + rectScreen.width,
        y: rectScreen.y + rectScreen.height
      })
      const rectWorld = rectFromPoints(startWorld, endWorld)

      isSelectingRef.current = true
      latestRectWorldRef.current = rectWorld
      instance.commands.selection.updateBox(rectScreen, rectWorld)

      if (rafRef.current !== null) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        const latestRectWorld = latestRectWorldRef.current
        if (!latestRectWorld) return
        hitTest(latestRectWorld, modeRef.current)
      })
    },
    [hitTest, instance]
  )

  const cancelPendingRaf = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    latestRectWorldRef.current = null
  }, [])

  const endBox = useCallback(() => {
    startRef.current = null
    cancelPendingRaf()
    isSelectingRef.current = false
    activePointerIdRef.current = null
    instance.commands.selection.endBox()
  }, [cancelPendingRaf, instance])

  useEffect(() => {
    return () => {
      cancelPendingRaf()
      activePointerIdRef.current = null
      startRef.current = null
      isSelectingRef.current = false
    }
  }, [cancelPendingRaf])

  const isSelectionToolEnabled = useCallback(() => {
    return instance.state.read('tool') !== 'edge'
  }, [instance])

  const handlers = useMemo<SelectionHandlers | undefined>(() => {
    if (!enabled) return undefined

    const getScreenPoint = (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
      const element = instance.runtime.containerRef.current
      if (!element) return null
      return instance.runtime.viewport.clientToScreen(event.clientX, event.clientY)
    }

    const isActivePointer = (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
      const pointerId = activePointerIdRef.current
      if (pointerId === null) return true
      return pointerId === event.pointerId
    }

    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!isSelectionToolEnabled()) return
        if (event.button !== 0) return
        if (instance.state.read('spacePressed')) return
        if (!instance.query.isCanvasBackgroundTarget(event.target)) return

        const point = getScreenPoint(event)
        if (!point) return

        const mode = getSelectionModeFromEvent('nativeEvent' in event ? event.nativeEvent : event)
        beginBox(point, mode)
        activePointerIdRef.current = event.pointerId
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!startRef.current) return
        if (!isActivePointer(event)) return

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
        if (!isActivePointer(event)) return

        if (!isSelectingRef.current && modeRef.current === 'replace') {
          clear()
        }
        endBox()
      }
    }
  }, [beginBox, clear, enabled, endBox, instance, isSelectionToolEnabled, minDragDistance, updateBox])

  return useMemo(
    () => ({
      beginBox,
      updateBox,
      endBox,
      getModeFromEvent: getSelectionModeFromEvent,
      handlers,
      cancelPendingRaf
    }),
    [beginBox, cancelPendingRaf, endBox, handlers, updateBox]
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
