import { useCallback } from 'react'
import { useAtomValue } from 'jotai'
import type { RefObject } from 'react'
import type { Point } from '@whiteboard/core'
import { selectionApiAtom } from '../../node/state/selectionApiAtom'
import { useEdgeConnect } from '../../edge/hooks/useEdgeConnect'

type ViewportHandlers = {
  onPointerDownCapture: (event: PointerEvent) => void
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
}

type Options = {
  containerRef: RefObject<HTMLDivElement>
  viewportHandlers: ViewportHandlers
  screenToWorld?: (point: Point) => Point
  tool?: 'select' | 'edge'
  onShortcutPointerDownCapture: (event: PointerEvent, onUnhandled?: () => void) => void
  onShortcutKeyDown: (event: KeyboardEvent) => void
}

export const useCanvasHandlers = ({
  containerRef,
  viewportHandlers,
  screenToWorld,
  tool = 'select',
  onShortcutPointerDownCapture,
  onShortcutKeyDown
}: Options) => {
  const selectionApi = useAtomValue(selectionApiAtom)
  const { selectEdge, updateHover } = useEdgeConnect()
  const selectionHandlers = selectionApi?.handlers

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      containerRef.current?.focus({ preventScroll: true })
      viewportHandlers.onPointerDown(event)
      selectionHandlers?.onPointerDown(event)
      if (event.target === containerRef.current) {
        selectEdge(undefined)
      }
    },
    [containerRef, selectEdge, selectionHandlers, viewportHandlers]
  )

  const handlePointerDownCapture = useCallback(
    (event: PointerEvent) => {
      onShortcutPointerDownCapture(event, () => viewportHandlers.onPointerDownCapture(event))
    },
    [onShortcutPointerDownCapture, viewportHandlers]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerMove(event)
      selectionHandlers?.onPointerMove(event)
      if (tool === 'edge' && screenToWorld && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        updateHover(screenToWorld(point))
      }
    },
    [containerRef, screenToWorld, selectionHandlers, tool, updateHover, viewportHandlers]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerUp(event)
      selectionHandlers?.onPointerUp(event)
    },
    [selectionHandlers, viewportHandlers]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      onShortcutKeyDown(event)
    },
    [onShortcutKeyDown]
  )

  return {
    handlePointerDown,
    handlePointerDownCapture,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown
  }
}
