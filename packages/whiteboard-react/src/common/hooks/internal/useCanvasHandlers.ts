import { useCallback } from 'react'
import type { ViewportConfig } from 'types/common'
import { useSelectionRuntime } from '../../../node/hooks'
import { useShortcutHandlers } from '../../shortcuts/useShortcutHandlers'
import { useInstance } from '../useInstance'
import { useCanvasViewportHandlers } from './useCanvasViewportHandlers'
import { useEdgeHoverHandlers } from './useEdgeHoverHandlers'

type Options = {
  tool?: 'select' | 'edge'
  viewportConfig?: ViewportConfig
}

export const useCanvasHandlers = ({ tool = 'select', viewportConfig }: Options) => {
  const instance = useInstance()
  const selectionRuntime = useSelectionRuntime()
  const selectionHandlers = selectionRuntime.handlers
  const getShortcutContext = useCallback(() => instance.query.getShortcutContext(), [instance])
  const { handlePointerDownCapture: handleShortcutPointerDownCapture, handleKeyDown: handleShortcutKeyDown } =
    useShortcutHandlers({
      shortcutManager: instance.runtime.shortcuts,
      getShortcutContext,
      updateInteraction: instance.commands.interaction.update
    })
  const edgeHoverHandlers = useEdgeHoverHandlers({ enabled: tool === 'edge' })
  const viewportHandlers = useCanvasViewportHandlers({
    instance,
    minZoom: viewportConfig?.minZoom,
    maxZoom: viewportConfig?.maxZoom,
    enablePan: viewportConfig?.enablePan,
    enableWheel: viewportConfig?.enableWheel
  })

  const runPointerDownShared = useCallback(
    (event: PointerEvent) => {
      instance.runtime.containerRef.current?.focus({ preventScroll: true })
      viewportHandlers.onPointerDown(event)
      selectionHandlers?.onPointerDown(event)
    },
    [instance, selectionHandlers, viewportHandlers]
  )

  const runPointerMoveShared = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerMove(event)
      selectionHandlers?.onPointerMove(event)
    },
    [selectionHandlers, viewportHandlers]
  )

  const runPointerUpShared = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerUp(event)
      selectionHandlers?.onPointerUp(event)
    },
    [selectionHandlers, viewportHandlers]
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      runPointerDownShared(event)
      if (event.target === instance.runtime.containerRef.current) {
        instance.commands.edge.select(undefined)
      }
    },
    [instance, runPointerDownShared]
  )

  const handlePointerDownCapture = useCallback(
    (event: PointerEvent) => {
      handleShortcutPointerDownCapture(event, () => viewportHandlers.onPointerDownCapture(event))
    },
    [handleShortcutPointerDownCapture, viewportHandlers]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      runPointerMoveShared(event)
      edgeHoverHandlers.onPointerMove(event)
    },
    [edgeHoverHandlers, runPointerMoveShared]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      runPointerUpShared(event)
    },
    [runPointerUpShared]
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
