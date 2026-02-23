import type { Lifecycle as LifecycleApi, LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { LifecycleRuntimeContext } from '../contracts'
import { Actor as EdgeActor } from '../actors/edge/Actor'
import { Actor as HistoryActor } from '../actors/history/Actor'
import { Sync as HistorySync } from '../actors/history/Sync'
import { Actor as MindmapActor } from '../actors/mindmap/Actor'
import { Actor as NodeActor } from '../actors/node/Actor'
import { Actor as SelectionActor } from '../actors/selection/Actor'
import { Actor as ToolActor } from '../actors/tool/Actor'
import { Actor as ViewportActor } from '../actors/viewport/Actor'
import { createDefaultConfig } from './config'
import { Container } from './Container'
import { Registry } from './Registry'

type LifecycleInputSyncOptions = {
  onViewportConfigChange?: (viewportConfig: LifecycleConfig['viewportConfig']) => void
}

type LifecycleActors = {
  edge: EdgeActor
  node: NodeActor
  mindmap: MindmapActor
  history: HistoryActor
  selection: SelectionActor
}

export class Lifecycle implements LifecycleApi {
  private context: LifecycleRuntimeContext
  private started = false
  private config: LifecycleConfig
  private history: HistorySync
  private container: Container
  private readonly registry = new Registry()
  private inputSync: LifecycleInputSyncOptions
  private selectionActor: SelectionActor
  private toolActor: ToolActor
  private viewportActor: ViewportActor
  private historyActor: HistoryActor
  private edgeActor: EdgeActor
  private nodeActor: NodeActor
  private mindmapActor: MindmapActor

  constructor(
    context: LifecycleRuntimeContext,
    inputSync: LifecycleInputSyncOptions = {},
    actors: LifecycleActors
  ) {
    this.context = context
    this.config = createDefaultConfig(context.runtime)
    this.inputSync = inputSync

    this.history = new HistorySync(this.context)
    this.container = new Container({
      context: this.context
    })
    this.edgeActor = actors.edge
    this.nodeActor = actors.node

    this.selectionActor = actors.selection
    this.toolActor = new ToolActor({
      state: this.context.state,
      emit: context.events.emit
    })
    this.viewportActor = new ViewportActor({
      state: this.context.state,
      emit: context.events.emit
    })
    this.historyActor = actors.history
    this.mindmapActor = actors.mindmap

    this.registry.register({
      start: this.history.start,
      stop: this.history.stop
    })
    this.registry.register({
      start: this.context.runtime.services.groupAutoFit.start,
      stop: this.context.runtime.services.groupAutoFit.stop
    })
    this.registry.register({
      start: this.selectionActor.start,
      stop: this.selectionActor.stop
    })
    this.registry.register({
      start: this.toolActor.start,
      stop: this.toolActor.stop
    })
    this.registry.register({
      start: this.viewportActor.start,
      stop: this.viewportActor.stop
    })
    this.registry.register({
      start: this.historyActor.start,
      stop: this.historyActor.stop
    })
    this.registry.register({
      start: this.mindmapActor.start,
      stop: this.mindmapActor.stop
    })
    this.registry.register({
      start: this.container.sync,
      stop: this.container.stop
    })
    this.registry.register({
      stop: this.edgeActor.cancelInteractions
    })
    this.registry.register({
      stop: this.nodeActor.cancelInteractions
    })
    this.registry.register({
      stop: this.mindmapActor.cancelDrag
    })
    this.registry.register({
      stop: this.edgeActor.resetTransientState
    })
    this.registry.register({
      stop: this.nodeActor.resetTransientState
    })
    this.registry.register({
      stop: this.mindmapActor.resetTransientState
    })
    this.registry.register({
      stop: this.context.runtime.shortcuts.dispose
    })
    this.registry.register({
      stop: this.context.runtime.services.nodeSizeObserver.dispose
    })
    this.registry.register({
      stop: this.context.runtime.services.containerSizeObserver.dispose
    })
    this.registry.register({
      stop: this.context.runtime.services.viewportNavigation.dispose
    })

    this.inputSync.onViewportConfigChange?.(this.config.viewportConfig)
  }

  private applyConfig = (config: LifecycleConfig) => {
    this.history.update(config)

    this.context.state.write('tool', config.tool)
    this.context.runtime.viewport.setViewport(config.viewport)
    this.context.runtime.shortcuts.setShortcuts(config.shortcuts)
    this.context.state.write('mindmapLayout', config.mindmapLayout ?? {})
    this.inputSync.onViewportConfigChange?.(config.viewportConfig)
  }

  private syncConfig = (config: LifecycleConfig) => {
    if (config.tool !== 'edge') {
      this.edgeActor.hoverCancel()
    }

    if (!this.started) return

    this.container.sync()
  }

  start: LifecycleApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.registry.startAll()
  }

  update: LifecycleApi['update'] = (config) => {
    this.applyConfig(config)
    this.config = config
    this.syncConfig(config)
  }

  stop: LifecycleApi['stop'] = () => {
    if (!this.started) return
    this.started = false

    this.registry.stopAll()
  }
}
