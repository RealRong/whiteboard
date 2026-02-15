import type { LifecycleConfig } from '@engine-types/instance'
import type { Instance } from '@engine-types/instance'
import { createShortcutInputHandlers } from '../shortcut'
import type { CanvasInputRuntime } from '..'
import { createEdgeHoverInputHandlers } from './edgeHover'
import { createSelectionInputHandlers } from './selection'
import { createViewportInputHandlers } from './viewport'

type Options = {
  instance: Instance
  config: LifecycleConfig
}

export const createCanvasInputHandlers = ({ instance, config }: Options): CanvasInputRuntime => {
  const selectionHandlers = createSelectionInputHandlers({
    instance,
    enabled: config.tool !== 'edge',
    minDragDistance: instance.runtime.config.node.selectionMinDragDistance
  })
  const edgeHoverHandlers = createEdgeHoverInputHandlers({
    instance,
    enabled: config.tool === 'edge'
  })
  const viewportHandlers = createViewportInputHandlers({
    instance,
    minZoom: config.viewportConfig.minZoom,
    maxZoom: config.viewportConfig.maxZoom,
    enablePan: config.viewportConfig.enablePan,
    enableWheel: config.viewportConfig.enableWheel,
    wheelSensitivity: config.viewportConfig.wheelSensitivity
  })
  const shortcutHandlers = createShortcutInputHandlers({ instance })

  return {
    handlers: {
      handlePointerDown: (event) => {
        instance.runtime.containerRef.current?.focus({ preventScroll: true })
        viewportHandlers.onPointerDown(event)
        selectionHandlers.onPointerDown(event)

        if (event.target === instance.runtime.containerRef.current) {
          instance.commands.edge.select(undefined)
        }
      },
      handlePointerDownCapture: (event) => {
        shortcutHandlers.handlePointerDownCapture(event, () => viewportHandlers.onPointerDownCapture(event))
      },
      handlePointerMove: (event) => {
        viewportHandlers.onPointerMove(event)
        edgeHoverHandlers.onPointerMove(event)
      },
      handlePointerUp: (event) => {
        viewportHandlers.onPointerUp(event)
      },
      handleKeyDown: (event) => {
        shortcutHandlers.handleKeyDown(event)
      }
    },
    selectionBox: {
      watchActive: selectionHandlers.watchActive,
      isActive: selectionHandlers.isActive,
      getPointerId: selectionHandlers.getPointerId,
      handlePointerMove: selectionHandlers.onPointerMove,
      handlePointerUp: selectionHandlers.onPointerUp,
      handlePointerCancel: selectionHandlers.onPointerCancel
    },
    onWheel: viewportHandlers.onWheel,
    cancel: () => {
      selectionHandlers.cancel()
      edgeHoverHandlers.cancel()
    }
  }
}
