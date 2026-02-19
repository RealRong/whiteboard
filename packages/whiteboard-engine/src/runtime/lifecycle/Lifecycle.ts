import type { InternalInstance } from '@engine-types/instance/instance'
import type { Lifecycle as LifecycleApi, LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { DomBindings } from '../../host/dom'
import {
  createSelectionEvents,
  type SelectionEventsWatcher
} from './watchers/selectionEvents'
import {
  createStateEvents,
  type StateEventsWatcher
} from './watchers/stateEvents'
import {
  createWindowBindings,
  startWindowBindings,
  stopWindowBindings,
  syncWindowBindings,
  type WindowBinding
} from './bindings/windowBindings'
import { Cleanup } from './Cleanup'
import { createDefaultConfig } from './config'
import { Container } from './Container'
import { History } from './history/History'
import { createCanvasInput } from './input/canvas/handlers'
import type { CanvasEventHandlers, CanvasInput } from './input/types'
import { WindowKey } from './WindowKey'

export class Lifecycle implements LifecycleApi {
  private instance: InternalInstance
  private started = false
  private config: LifecycleConfig
  private input: CanvasInput
  private history: History
  private container: Container
  private windowKey: WindowKey
  private cleanup: Cleanup
  private windowBindings: WindowBinding[]
  private selectionEvents: SelectionEventsWatcher
  private stateEvents: StateEventsWatcher

  constructor(
    instance: InternalInstance,
    dom: DomBindings,
    emitEvent: InstanceEventEmitter['emit']
  ) {
    this.instance = instance
    this.config = createDefaultConfig(instance)
    this.input = createCanvasInput({ instance: this.instance, config: this.config })

    this.history = new History(this.instance)
    this.container = new Container({
      instance: this.instance,
      dom,
      getHandlers: () => this.handlers,
      getOnWheel: () => this.onWheel
    })
    this.windowKey = new WindowKey({
      instance: this.instance,
      dom
    })
    this.cleanup = new Cleanup(this.instance)

    this.selectionEvents = createSelectionEvents({
      state: this.instance.state,
      emit: emitEvent
    })
    this.stateEvents = createStateEvents({
      state: this.instance.state,
      emit: emitEvent
    })
    this.windowBindings = createWindowBindings({
      instance: this.instance,
      dom,
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
    this.input = createCanvasInput({ instance: this.instance, config })

    if (!this.started) return
    stopWindowBindings(this.windowBindings)
    startWindowBindings(this.windowBindings)
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

    this.instance.commands.tool.set(config.tool)
    this.instance.runtime.viewport.setViewport(config.viewport)
    this.instance.runtime.shortcuts.setShortcuts(config.shortcuts)
    this.instance.state.write('mindmapLayout', config.mindmapLayout ?? {})
  }

  private syncConfig = (config: LifecycleConfig) => {
    if (config.tool !== 'edge') {
      this.instance.runtime.interaction.edgeConnect.hoverCancel()
    }

    if (!this.started) return

    this.container.sync()
    syncWindowBindings(this.windowBindings)
  }

  start: LifecycleApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.history.start()
    this.instance.runtime.services.groupAutoFit.start()
    this.windowKey.start()
    this.selectionEvents.start()
    this.stateEvents.start()
    startWindowBindings(this.windowBindings)
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
    stopWindowBindings(this.windowBindings)
    this.selectionEvents.stop()
    this.stateEvents.stop()
    this.container.stop()
    this.windowKey.stop()
    this.instance.runtime.services.groupAutoFit.stop()
    this.cleanup.stop()
  }
}
