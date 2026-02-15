import type { Instance } from '@engine-types/instance'
import type { Lifecycle as LifecycleApi, LifecycleConfig } from '@engine-types/instance'
import { createDefaultConfig } from './config'
import { createPhases, type Phases } from './factory'
import { createCanvasInputHandlers, type CanvasEventHandlers, type CanvasInputRuntime } from './input'

export class Lifecycle implements LifecycleApi {
  private instance: Instance
  private started = false
  private config: LifecycleConfig
  private input: CanvasInputRuntime
  private startFlow: Phases['start']
  private updateFlow: Phases['update']
  private stopFlow: Phases['stop']

  constructor(instance: Instance) {
    this.instance = instance
    this.config = createDefaultConfig(instance)
    this.input = createCanvasInputHandlers({ instance: this.instance, config: this.config })
    const phases = createPhases({
      instance: this.instance,
      getHandlers: () => this.handlers,
      getOnWheel: () => this.onWheel,
      getSelectionBox: () => this.input.selectionBox,
      resetInput: this.resetInput,
      cancelInput: () => this.input.cancel()
    })

    this.startFlow = phases.start
    this.updateFlow = phases.update
    this.stopFlow = phases.stop
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

  private resetInput = () => {
    this.input.cancel()
    this.input = createCanvasInputHandlers({ instance: this.instance, config: this.config })
  }

  start: LifecycleApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.startFlow.start()
  }

  update: LifecycleApi['update'] = (config) => {
    this.config = config
    this.updateFlow.update(config, this.started)
  }

  stop: LifecycleApi['stop'] = () => {
    if (!this.started) return
    this.started = false

    this.stopFlow.stop()
  }
}
