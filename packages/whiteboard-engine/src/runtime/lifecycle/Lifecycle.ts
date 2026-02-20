import type { Lifecycle as LifecycleApi, LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { LifecycleContext } from '../../context'
import {
  createSelectionEvents,
  type SelectionEventsWatcher
} from './watchers/selectionEvents'
import {
  createStateEvents,
  type StateEventsWatcher
} from './watchers/stateEvents'
import { Cleanup } from './Cleanup'
import { createDefaultConfig } from './config'
import { Container } from './Container'
import { History } from './history/History'

type LifecycleInputSyncOptions = {
  onViewportConfigChange?: (viewportConfig: LifecycleConfig['viewportConfig']) => void
}

export class Lifecycle implements LifecycleApi {
  private context: LifecycleContext
  private started = false
  private config: LifecycleConfig
  private history: History
  private container: Container
  private cleanup: Cleanup
  private inputSync: LifecycleInputSyncOptions
  private selectionEvents: SelectionEventsWatcher
  private stateEvents: StateEventsWatcher

  constructor(
    context: LifecycleContext,
    inputSync: LifecycleInputSyncOptions = {}
  ) {
    this.context = context
    this.config = createDefaultConfig(context.runtime)
    this.inputSync = inputSync

    this.history = new History(this.context)
    this.container = new Container({
      context: this.context
    })
    this.cleanup = new Cleanup(this.context)

    this.selectionEvents = createSelectionEvents({
      state: this.context.state,
      emit: context.events.emit
    })
    this.stateEvents = createStateEvents({
      state: this.context.state,
      emit: context.events.emit
    })

    this.inputSync.onViewportConfigChange?.(this.config.viewportConfig)
  }

  private applyConfig = (config: LifecycleConfig) => {
    this.history.update(config)

    this.context.commands.tool.set(config.tool)
    this.context.runtime.viewport.setViewport(config.viewport)
    this.context.runtime.shortcuts.setShortcuts(config.shortcuts)
    this.context.state.write('mindmapLayout', config.mindmapLayout ?? {})
    this.inputSync.onViewportConfigChange?.(config.viewportConfig)
  }

  private syncConfig = (config: LifecycleConfig) => {
    if (config.tool !== 'edge') {
      this.context.runtime.interaction.edgeConnect.hoverCancel()
    }

    if (!this.started) return

    this.container.sync()
  }

  start: LifecycleApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.history.start()
    this.context.runtime.services.groupAutoFit.start()
    this.selectionEvents.start()
    this.stateEvents.start()
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
    this.selectionEvents.stop()
    this.stateEvents.stop()
    this.container.stop()
    this.context.runtime.services.groupAutoFit.stop()
    this.cleanup.stop()
  }
}
