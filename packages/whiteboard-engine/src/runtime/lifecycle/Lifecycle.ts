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

type LifecycleInputSyncOptions = {
  onViewportConfigChange?: (viewportConfig: LifecycleConfig['viewportConfig']) => void
}

type LifecycleActors = {
  edge: EdgeActor
  node: NodeActor
  mindmap: MindmapActor
}

export class Lifecycle implements LifecycleApi {
  private context: LifecycleRuntimeContext
  private started = false
  private config: LifecycleConfig
  private history: HistorySync
  private container: Container
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

    this.selectionActor = new SelectionActor({
      state: this.context.state,
      emit: context.events.emit
    })
    this.toolActor = new ToolActor({
      state: this.context.state,
      emit: context.events.emit
    })
    this.viewportActor = new ViewportActor({
      state: this.context.state,
      emit: context.events.emit
    })
    this.historyActor = new HistoryActor({
      state: this.context.state,
      emit: context.events.emit
    })
    this.mindmapActor = actors.mindmap

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

    this.history.start()
    this.context.runtime.services.groupAutoFit.start()
    this.selectionActor.start()
    this.toolActor.start()
    this.viewportActor.start()
    this.historyActor.start()
    this.mindmapActor.start()
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
    this.selectionActor.stop()
    this.toolActor.stop()
    this.viewportActor.stop()
    this.historyActor.stop()
    this.mindmapActor.stop()
    this.container.stop()
    this.context.runtime.services.groupAutoFit.stop()
    this.edgeActor.cancelInteractions()
    this.nodeActor.cancelInteractions()
    this.mindmapActor.cancelDrag()
    this.edgeActor.resetTransientState()
    this.nodeActor.resetTransientState()
    this.mindmapActor.resetTransientState()
    this.context.runtime.shortcuts.dispose()
    this.context.runtime.services.nodeSizeObserver.dispose()
    this.context.runtime.services.containerSizeObserver.dispose()
    this.context.runtime.services.viewportNavigation.dispose()
  }
}
