import { useMemo } from 'react'
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
  const selectionHandlers = useSelectionRuntime({ enabled: tool !== 'edge' }).handlers
  const { handlePointerDownCapture: handleShortcutPointerDownCapture, handleKeyDown: handleShortcutKeyDown } =
    useShortcutHandlers({
      shortcutManager: instance.runtime.shortcuts,
      getShortcutContext: instance.query.getShortcutContext,
      updateInteraction: instance.commands.interaction.update
    })

  const edgeHoverHandlers = useEdgeHoverHandlers({ enabled: tool === 'edge' })
  const {
    onPointerDownCapture,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel
  } = useCanvasViewportHandlers({
    instance,
    minZoom: viewportConfig?.minZoom,
    maxZoom: viewportConfig?.maxZoom,
    enablePan: viewportConfig?.enablePan,
    enableWheel: viewportConfig?.enableWheel,
    wheelSensitivity: viewportConfig?.wheelSensitivity
  })

  const handlers = useMemo(
    () => ({
      handlePointerDown: (event: PointerEvent) => {
        instance.runtime.containerRef.current?.focus({ preventScroll: true })
        onPointerDown(event)
        selectionHandlers?.onPointerDown(event)

        if (event.target === instance.runtime.containerRef.current) {
          instance.commands.edge.select(undefined)
        }
      },
      handlePointerDownCapture: (event: PointerEvent) => {
        handleShortcutPointerDownCapture(event, () => onPointerDownCapture(event))
      },
      handlePointerMove: (event: PointerEvent) => {
        onPointerMove(event)
        selectionHandlers?.onPointerMove(event)
        edgeHoverHandlers.onPointerMove(event)
      },
      handlePointerUp: (event: PointerEvent) => {
        onPointerUp(event)
        selectionHandlers?.onPointerUp(event)
      },
      handleKeyDown: (event: KeyboardEvent) => {
        handleShortcutKeyDown(event)
      }
    }),
    [
      edgeHoverHandlers,
      handleShortcutKeyDown,
      handleShortcutPointerDownCapture,
      instance,
      onPointerDown,
      onPointerDownCapture,
      onPointerMove,
      onPointerUp,
      selectionHandlers
    ]
  )

  return useMemo(
    () => ({
      handlers,
      onWheel
    }),
    [handlers, onWheel]
  )
}
