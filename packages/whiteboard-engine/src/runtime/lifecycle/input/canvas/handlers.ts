import type { LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import { createShortcut } from '../shortcut/handlers'
import type { CanvasInput } from '../types'
import { createSelection } from './selection'
import { createViewport } from './viewport'

type Options = {
  context: LifecycleContext
  config: LifecycleConfig
}

export const createCanvasInput = ({ context, config }: Options): CanvasInput => {
  const selectionHandlers = createSelection({
    context,
    enabled: config.tool !== 'edge',
    minDragDistance: context.runtime.config.node.selectionMinDragDistance
  })
  const edgeHoverEnabled = config.tool === 'edge'
  const viewportHandlers = createViewport({
    context,
    minZoom: config.viewportConfig.minZoom,
    maxZoom: config.viewportConfig.maxZoom,
    enablePan: config.viewportConfig.enablePan,
    enableWheel: config.viewportConfig.enableWheel,
    wheelSensitivity: config.viewportConfig.wheelSensitivity
  })
  const shortcutHandlers = createShortcut({ context })

  return {
    handlers: {
      handlePointerDown: (event) => {
        context.runtime.containerRef.current?.focus({ preventScroll: true })
        viewportHandlers.onPointerDown(event)
        selectionHandlers.onPointerDown(event)

        if (event.target === context.runtime.containerRef.current) {
          context.commands.edge.select(undefined)
        }
      },
      handlePointerDownCapture: (event) => {
        shortcutHandlers.handlePointerDownCapture(event, () => viewportHandlers.onPointerDownCapture(event))
      },
      handlePointerMove: (event) => {
        const pointer = toPointerInput(context.runtime.viewport, event)
        viewportHandlers.onPointerMove(event)
        context.runtime.interaction.edgeConnect.hoverMove(pointer, edgeHoverEnabled)
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
      getPointerId: selectionHandlers.getPointerId,
      handlePointerMove: selectionHandlers.onPointerMove,
      handlePointerUp: selectionHandlers.onPointerUp,
      handlePointerCancel: selectionHandlers.onPointerCancel
    },
    onWheel: viewportHandlers.onWheel,
    cancel: () => {
      selectionHandlers.cancel()
      context.runtime.interaction.edgeConnect.hoverCancel()
    }
  }
}
