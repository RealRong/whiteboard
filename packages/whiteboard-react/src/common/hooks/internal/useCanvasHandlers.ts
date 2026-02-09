import { useCallback, useMemo, useRef } from 'react'
import type { Point } from '@whiteboard/core'
import type { ViewportConfig } from 'types/common'
import { useSelectionRuntime } from '../../../node/hooks'
import { useInstance } from '../useInstance'
import { useViewportControls } from './useViewportControls'
import { useShortcutHandlers } from '../../shortcuts/useShortcutHandlers'
import { createShortcutContextGetter } from './runtime/createShortcutContextGetter'

type Options = {
  tool?: 'select' | 'edge'
  viewportConfig?: ViewportConfig
}

export const useCanvasHandlers = ({ tool = 'select', viewportConfig }: Options) => {
  const instance = useInstance()
  const selectionRuntime = useSelectionRuntime()
  const selectionHandlers = selectionRuntime.handlers
  const getShortcutContext = useMemo(() => createShortcutContextGetter(instance), [instance])
  const edgeHoverPointRef = useRef<Point | null>(null)
  const edgeHoverRafRef = useRef<number | null>(null)
  const { handlePointerDownCapture: handleShortcutPointerDownCapture, handleKeyDown: handleShortcutKeyDown } =
    useShortcutHandlers({
      shortcutManager: instance.runtime.shortcuts,
      getShortcutContext,
      updateInteraction: instance.commands.interaction.update
    })
  const flushEdgeHover = useCallback(() => {
    edgeHoverRafRef.current = null
    const point = edgeHoverPointRef.current
    if (!point) return
    edgeHoverPointRef.current = null
    instance.commands.edgeConnect.updateHover(instance.runtime.viewport.screenToWorld(point))
  }, [instance])

  const viewportHandlers = useViewportControls({
    instance,
    containerRef: instance.runtime.containerRef,
    minZoom: viewportConfig?.minZoom,
    maxZoom: viewportConfig?.maxZoom,
    enablePan: viewportConfig?.enablePan,
    enableWheel: viewportConfig?.enableWheel
  })
  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      instance.runtime.containerRef.current?.focus({ preventScroll: true })
      viewportHandlers.onPointerDown(event)
      selectionHandlers?.onPointerDown(event)
      if (event.target === instance.runtime.containerRef.current) {
        instance.commands.edge.select(undefined)
      }
    },
    [instance, selectionHandlers, viewportHandlers]
  )

  const handlePointerDownCapture = useCallback(
    (event: PointerEvent) => {
      handleShortcutPointerDownCapture(event, () => viewportHandlers.onPointerDownCapture(event))
    },
    [handleShortcutPointerDownCapture, viewportHandlers]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerMove(event)
      selectionHandlers?.onPointerMove(event)
      if (tool === 'edge' && instance.runtime.containerRef.current) {
        const rect = instance.runtime.containerRef.current.getBoundingClientRect()
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        edgeHoverPointRef.current = point
        if (edgeHoverRafRef.current === null) {
          edgeHoverRafRef.current = requestAnimationFrame(flushEdgeHover)
        }
      }
    },
    [flushEdgeHover, instance, selectionHandlers, tool, viewportHandlers]
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
      handleShortcutKeyDown(event)
    },
    [handleShortcutKeyDown]
  )

  return {
    handlers: {
      handlePointerDown,
      handlePointerDownCapture,
      handlePointerMove,
      handlePointerUp,
      handleKeyDown
    },
    onWheel: viewportHandlers.onWheel
  }
}
