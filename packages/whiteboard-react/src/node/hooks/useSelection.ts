import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Node, Point, Rect } from '@whiteboard/core'
import type { Size } from '../../common/types'
import type { SelectionMode, SelectionState } from '../../common/state/whiteboardAtoms'
import { selectionAtom, setSelectionAtom } from '../../common/state/whiteboardAtoms'
import { useInstance } from '../../common/hooks/useInstance'
import {
  getNodeRect,
  rectContains,
  rectContainsRotatedRect,
  rectFromPoints,
  rectIntersects,
  rectIntersectsRotatedRect
} from '../../common/utils/geometry'

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
}

const applySelectionMode = (current: Set<string>, ids: string[], mode: SelectionMode) => {
  const next = new Set(current)
  if (mode === 'replace') {
    next.clear()
    ids.forEach((id) => next.add(id))
    return next
  }
  if (mode === 'add') {
    ids.forEach((id) => next.add(id))
    return next
  }
  if (mode === 'subtract') {
    ids.forEach((id) => next.delete(id))
    return next
  }
  ids.forEach((id) => {
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
  })
  return next
}

export const useSelection = (options: UseSelectionOptions = {}): UseSelectionReturn => {
  const state = useAtomValue(selectionAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  const instance = useInstance()
  const startRef = useRef<Point | null>(null)
  const modeRef = useRef<SelectionMode>('replace')
  const rafRef = useRef<number | null>(null)
  const spacePressedRef = useRef(false)
  const minDragDistance = options.minDragDistance ?? 3
  const enabled = options.enabled ?? true

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = true
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = false
      }
    }
    const offKeyDown = instance.addWindowEventListener('keydown', onKeyDown)
    const offKeyUp = instance.addWindowEventListener('keyup', onKeyUp)
    return () => {
      offKeyDown()
      offKeyUp()
    }
  }, [instance])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const getModeFromEvent = useCallback((event: PointerEvent | MouseEvent): SelectionMode => {
    if (event.altKey) return 'subtract'
    if (event.metaKey || event.ctrlKey) return 'toggle'
    if (event.shiftKey) return 'add'
    return 'replace'
  }, [])

  const getClickModeFromEvent = getModeFromEvent

  const select = useCallback(
    (ids: string[], mode: SelectionMode = 'replace') => {
      setSelection((prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, mode)
      }))
    },
    [setSelection]
  )

  const toggle = useCallback(
    (ids: string[]) => {
      setSelection((prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    [setSelection]
  )

  const clear = useCallback(() => {
    setSelection((prev) => ({
      ...prev,
      selectedNodeIds: new Set<string>(),
      isSelecting: false,
      selectionRect: undefined,
      selectionRectWorld: undefined
    }))
  }, [setSelection])

  const beginBox = useCallback(
    (pointScreen: Point, mode: SelectionMode = 'replace') => {
      startRef.current = pointScreen
      modeRef.current = mode
      setSelection((prev) => ({
        ...prev,
        mode,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    },
    [setSelection]
  )

  const hitTest = useCallback(
    (rectWorld: Rect, mode: SelectionMode) => {
      if (!options.nodes || !options.nodeSize) return
      const matched: string[] = []
      options.nodes.forEach((node) => {
        const nodeRect = getNodeRect(node, options.nodeSize as Size)
        const rotation = typeof node.rotation === 'number' ? node.rotation : 0
        const hit =
          node.type === 'group'
            ? rectContainsRotatedRect(rectWorld, nodeRect, rotation)
            : rectIntersectsRotatedRect(rectWorld, nodeRect, rotation)
        if (hit) matched.push(node.id)
      })
      select(matched, mode)
    },
    [options.nodeSize, options.nodes, select]
  )

  const updateBox = useCallback(
    (pointScreen: Point) => {
      const start = startRef.current
      if (!start) return
      const rectScreen = rectFromPoints(start, pointScreen)
      let rectWorld: Rect | undefined
      if (options.screenToWorld) {
        const startWorld = options.screenToWorld({ x: rectScreen.x, y: rectScreen.y })
        const endWorld = options.screenToWorld({
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
    [hitTest, options.screenToWorld, setSelection]
  )

  const endBox = useCallback(() => {
    startRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setSelection((prev) => ({
      ...prev,
      isSelecting: false,
      selectionRect: undefined,
      selectionRectWorld: undefined
    }))
  }, [setSelection])

  const isSelected = useCallback((id: string) => state.selectedNodeIds.has(id), [state.selectedNodeIds])
  const hasSelection = useCallback(() => state.selectedNodeIds.size > 0, [state.selectedNodeIds])

  const handlers = useMemo(() => {
    if (!enabled) return undefined
    if (!options.containerRef || !options.screenToWorld) return undefined
    const container = options.containerRef

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
        if (spacePressedRef.current) return
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
    options.containerRef,
    options.screenToWorld,
    state.isSelecting,
    updateBox
  ])

  return {
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
    handlers
  }
}
