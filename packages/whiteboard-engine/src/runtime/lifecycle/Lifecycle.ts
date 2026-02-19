import type { Lifecycle as LifecycleApi, LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { DomBindings } from '../../host/dom'
import type { LifecycleContext } from '../../context'
import {
  createSelectionEvents,
  type SelectionEventsWatcher
} from './watchers/selectionEvents'
import {
  createStateEvents,
  type StateEventsWatcher
} from './watchers/stateEvents'
import { WindowBindings } from './dom/windowBindings'
import { Cleanup } from './Cleanup'
import { createDefaultConfig } from './config'
import { Container } from './Container'
import { History } from './history/History'
import { createCanvasInput } from './input/canvas/handlers'
import type { CanvasEventHandlers, CanvasInput } from './input/types'
import { WindowKey } from './WindowKey'

export class Lifecycle implements LifecycleApi {
  private context: LifecycleContext
  private started = false
  private config: LifecycleConfig
  private input: CanvasInput
  private history: History
  private container: Container
  private windowKey: WindowKey
  private cleanup: Cleanup
  private windowBindings: WindowBindings
  private selectionEvents: SelectionEventsWatcher
  private stateEvents: StateEventsWatcher

  constructor(context: LifecycleContext, dom: DomBindings) {
    this.context = context
    this.config = createDefaultConfig(context.runtime)
    this.input = createCanvasInput({
      context: this.context,
      config: this.config
    })

    this.history = new History(this.context)
    this.container = new Container({
      context: this.context,
      dom,
      handlers: this.handlers,
      onWheel: this.onWheel
    })
    this.windowKey = new WindowKey(this.context, dom)
    this.cleanup = new Cleanup(this.context)

    this.selectionEvents = createSelectionEvents({
      state: this.context.state,
      emit: context.events.emit
    })
    this.stateEvents = createStateEvents({
      state: this.context.state,
      emit: context.events.emit
    })
    this.windowBindings = new WindowBindings({
      context: this.context,
      onWindow: dom.onWindow,
      getSelectionBox: () => this.input.selectionBox
    })
  }

  private handlers: CanvasEventHandlers = {
    handlePointerDown: (event) => {
      this.input.handlers.handlePointerDown(event)
    },
    handlePointerDownCapture: (event) => {
      this.input.handlers.handlePointerDownCapture(event)
    },
    handlePointerMove: (event) => {
      this.input.handlers.handlePointerMove(event)
    },
    handlePointerUp: (event) => {
      this.input.handlers.handlePointerUp(event)
    },
    handleKeyDown: (event) => {
      this.input.handlers.handleKeyDown(event)
    }
  }

  private onWheel = (event: WheelEvent) => {
    this.input.onWheel(event)
  }

  private recreateInput = (config: LifecycleConfig) => {
    this.input.cancel()
    this.input = createCanvasInput({
      context: this.context,
      config
    })

    if (!this.started) return
    this.windowBindings.stop()
    this.windowBindings.start()
  }

  private shouldRecreateInput = (nextConfig: LifecycleConfig) => {
    const previous = this.config
    if (previous.tool !== nextConfig.tool) return true

    const prevViewport = previous.viewportConfig
    const nextViewport = nextConfig.viewportConfig
    if (prevViewport.minZoom !== nextViewport.minZoom) return true
    if (prevViewport.maxZoom !== nextViewport.maxZoom) return true
    if (prevViewport.enablePan !== nextViewport.enablePan) return true
    if (prevViewport.enableWheel !== nextViewport.enableWheel) return true
    if (prevViewport.wheelSensitivity !== nextViewport.wheelSensitivity) return true

    return false
  }

  private applyConfig = (config: LifecycleConfig) => {
    if (this.shouldRecreateInput(config)) {
      this.recreateInput(config)
    }

    this.history.update(config)

    this.context.commands.tool.set(config.tool)
    this.context.runtime.viewport.setViewport(config.viewport)
    this.context.runtime.shortcuts.setShortcuts(config.shortcuts)
    this.context.state.write('mindmapLayout', config.mindmapLayout ?? {})
  }

  private syncConfig = (config: LifecycleConfig) => {
    if (config.tool !== 'edge') {
      this.context.runtime.interaction.edgeConnect.hoverCancel()
    }

    if (!this.started) return

    this.container.sync()
    this.windowBindings.sync()
  }

  start: LifecycleApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.history.start()
    this.context.runtime.services.groupAutoFit.start()
    this.windowKey.start()
    this.selectionEvents.start()
    this.stateEvents.start()
    this.windowBindings.start()
    this.container.sync()
  }

  update: LifecycleApi['update'] = (config) => {
    this.applyConfig(config)
    this.config = config
    this.syncConfig(config)
  }

  stop: LifecycleApi['stop'] = () => {
    if (!this.started) return
    this.started = false

    this.history.stop()
    this.input.cancel()
    this.windowBindings.stop()
    this.selectionEvents.stop()
    this.stateEvents.stop()
    this.container.stop()
    this.windowKey.stop()
    this.context.runtime.services.groupAutoFit.stop()
    this.cleanup.stop()
  }
}
