import type { LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { InternalInstance } from '@engine-types/instance/instance'
import { createShortcut } from '../shortcut/handlers'
import type { CanvasInput } from '../types'
import { createEdgeHover } from './edgeHover'
import { createSelection } from './selection'
import { createViewport } from './viewport'

type Options = {
  instance: InternalInstance
  config: LifecycleConfig
}

export const createCanvasInput = ({ instance, config }: Options): CanvasInput => {
  const selectionHandlers = createSelection({
    instance,
    enabled: config.tool !== 'edge',
    minDragDistance: instance.runtime.config.node.selectionMinDragDistance
  })
  const edgeHoverHandlers = createEdgeHover({
    instance,
    enabled: config.tool === 'edge'
  })
  const viewportHandlers = createViewport({
    instance,
    minZoom: config.viewportConfig.minZoom,
    maxZoom: config.viewportConfig.maxZoom,
    enablePan: config.viewportConfig.enablePan,
    enableWheel: config.viewportConfig.enableWheel,
    wheelSensitivity: config.viewportConfig.wheelSensitivity
  })
  const shortcutHandlers = createShortcut({ instance })

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
