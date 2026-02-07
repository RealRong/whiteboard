import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Node, Point, Rect } from '@whiteboard/core'
import type { Size } from '../../common/types'
import type { SelectionMode, SelectionState } from '../../common/state'
import { edgeSelectionAtom, nodeSelectionAtom, toolAtom } from '../../common/state'
import { useCanvasNodes, useInstance, useSpacePressed, useWhiteboardConfig } from '../../common/hooks'
import {
  getNodeRect,
  rectContainsRotatedRect,
  rectFromPoints,
  rectIntersectsRotatedRect
} from '../../common/utils/geometry'
import { applySelectionMode, getSelectionModeFromEvent } from '../utils/selection'

export type { SelectionMode, SelectionState }

export type UseSelectionOptions = {
  containerRef?: RefObject<HTMLElement>
  screenToWorld?: (point: Point) => Point
  nodes?: Node[]
  nodeSize?: Size
  minDragDistance?: number
  enabled?: boolean
}

export type UseSelectionReturn = {
  tool: string
  selectedEdgeId?: string
  selectedNodeIds: Set<string>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  isSelected: (id: string) => boolean
  hasSelection: () => boolean
  select: (ids: string[], mode?: SelectionMode) => void
  toggle: (ids: string[]) => void
  clear: () => void
  beginBox: (pointScreen: Point, mode?: SelectionMode) => void
  updateBox: (pointScreen: Point) => void
  endBox: () => void
  getModeFromEvent: (event: PointerEvent | MouseEvent) => SelectionMode
  getClickModeFromEvent: (event: PointerEvent | MouseEvent) => SelectionMode
  handlers?: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => void
  }
  cancelPendingRaf: () => void
}

export const useSelection = (options: UseSelectionOptions = {}): UseSelectionReturn => {
  const [state, setSelection] = useAtom(nodeSelectionAtom)
  const tool = useAtomValue(toolAtom)
  const selectedEdgeId = useAtomValue(edgeSelectionAtom)
  const setEdgeSelection = useSetAtom(edgeSelectionAtom)
  const instance = useInstance()
  const canvasNodes = useCanvasNodes()
  const { nodeSize: fallbackNodeSize } = useWhiteboardConfig()
  const spacePressed = useSpacePressed()
  const startRef = useRef<Point | null>(null)
  const modeRef = useRef<SelectionMode>('replace')
  const rafRef = useRef<number | null>(null)
  const minDragDistance = options.minDragDistance ?? 3
  const enabled = options.enabled ?? tool !== 'edge'
  const containerRef = options.containerRef ?? instance.containerRef ?? undefined
  const screenToWorld = options.screenToWorld ?? instance.viewport.screenToWorld ?? undefined
  const nodes = options.nodes ?? canvasNodes
  const nodeSize = options.nodeSize ?? fallbackNodeSize

  const getModeFromEvent = useCallback(getSelectionModeFromEvent, [])

  const getClickModeFromEvent = getModeFromEvent

  const select = useCallback(
    (ids: string[], mode: SelectionMode = 'replace') => {
      setEdgeSelection(undefined)
      setSelection((prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, mode)
      }))
    },
    [setEdgeSelection, setSelection]
  )

  const toggle = useCallback(
    (ids: string[]) => {
      setEdgeSelection(undefined)
      setSelection((prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    [setEdgeSelection, setSelection]
  )

  const clear = useCallback(() => {
    setEdgeSelection(undefined)
    setSelection((prev) => ({
      ...prev,
      selectedNodeIds: new Set<string>(),
      isSelecting: false,
      selectionRect: undefined,
      selectionRectWorld: undefined
    }))
  }, [setEdgeSelection, setSelection])

  const beginBox = useCallback(
    (pointScreen: Point, mode: SelectionMode = 'replace') => {
      startRef.current = pointScreen
      modeRef.current = mode
      setEdgeSelection(undefined)
      setSelection((prev) => ({
        ...prev,
        mode,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    },
    [setEdgeSelection, setSelection]
  )

  const hitTest = useCallback(
    (rectWorld: Rect, mode: SelectionMode) => {
      if (!nodes.length) return
      const matched: string[] = []
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
    [nodeSize, nodes, select]
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
      setSelection((prev) => ({
        ...prev,
        isSelecting: true,
        selectionRect: rectScreen,
        selectionRectWorld: rectWorld
      }))
      if (rectWorld) {
        if (rafRef.current !== null) return
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null
          hitTest(rectWorld as Rect, modeRef.current)
        })
      }
    },
    [hitTest, screenToWorld, setSelection]
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
    setSelection((prev) => ({
      ...prev,
      isSelecting: false,
      selectionRect: undefined,
      selectionRectWorld: undefined
    }))
  }, [cancelPendingRaf, setSelection])

  const isSelected = useCallback((id: string) => state.selectedNodeIds.has(id), [state.selectedNodeIds])
  const hasSelection = useCallback(() => state.selectedNodeIds.size > 0, [state.selectedNodeIds])

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
        if (event.button !== 0) return
        if (spacePressed) return
        if (!isEventOnEmptyCanvas(event)) return
        const point = getScreenPoint(event)
        if (!point) return
        beginBox(point, getModeFromEvent(event))
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!startRef.current) return
        const point = getScreenPoint(event)
        if (!point) return
        const start = startRef.current
        const dx = Math.abs(point.x - start.x)
        const dy = Math.abs(point.y - start.y)
        if (!state.isSelecting && dx < minDragDistance && dy < minDragDistance) {
          return
        }
        event.preventDefault()
        updateBox(point)
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
        if (!startRef.current) return
        if (!state.isSelecting) {
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
    endBox,
    getModeFromEvent,
    minDragDistance,
    containerRef,
    screenToWorld,
    state.isSelecting,
    updateBox,
    enabled,
    spacePressed
  ])

  const api = useMemo(
    () => ({
      tool,
      selectedEdgeId,
      selectedNodeIds: state.selectedNodeIds,
      isSelecting: state.isSelecting,
      selectionRect: state.selectionRect,
      selectionRectWorld: state.selectionRectWorld,
      isSelected,
      hasSelection,
      select,
      toggle,
      clear,
      beginBox,
      updateBox,
      endBox,
      getModeFromEvent,
      getClickModeFromEvent,
      handlers,
      cancelPendingRaf
    }),
    [
      beginBox,
      cancelPendingRaf,
      clear,
      endBox,
      getClickModeFromEvent,
      getModeFromEvent,
      handlers,
      hasSelection,
      isSelected,
      select,
      selectedEdgeId,
      state.isSelecting,
      state.selectedNodeIds,
      state.selectionRect,
      state.selectionRectWorld,
      tool,
      toggle,
      updateBox
    ]
  )

  return api
}
