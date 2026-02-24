import type { Lifecycle as LifecycleApi, LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { State } from '@engine-types/instance/state'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { Shortcuts } from '@engine-types/shortcuts'
import type { ViewportApi } from '@engine-types/viewport'
import { Actor as EdgeActor } from '../actors/edge/Actor'
import { Actor as GroupAutoFitActor } from '../actors/groupAutoFit/Actor'
import { Actor as MindmapActor } from '../actors/mindmap/Actor'
import { Actor as NodeActor } from '../actors/node/Actor'
import { Actor as SelectionActor } from '../actors/selection/Actor'
import { Actor as ToolActor } from '../actors/tool/Actor'
import { Actor as ViewportActor } from '../actors/viewport/Actor'
import { Registry } from './Registry'

type LifecycleContext = {
  state: State
  viewport: Pick<ViewportApi, 'setViewport'>
  syncViewport: () => void
  shortcuts: Pick<Shortcuts, 'setShortcuts' | 'dispose'>
  emit: InstanceEventEmitter['emit']
}

type LifecycleActors = {
  edge: EdgeActor
  groupAutoFit: GroupAutoFitActor
  node: NodeActor
  mindmap: MindmapActor
  selection: SelectionActor
}

export class Lifecycle implements LifecycleApi {
  private context: LifecycleContext
  private started = false
  private readonly registry = new Registry()
  private selectionActor: SelectionActor
  private toolActor: ToolActor
  private viewportActor: ViewportActor
  private edgeActor: EdgeActor
  private groupAutoFitActor: GroupAutoFitActor
  private nodeActor: NodeActor
  private mindmapActor: MindmapActor

  constructor(
    context: LifecycleContext,
    actors: LifecycleActors
  ) {
    this.context = context

    this.edgeActor = actors.edge
    this.groupAutoFitActor = actors.groupAutoFit
    this.nodeActor = actors.node

    this.selectionActor = actors.selection
    this.toolActor = new ToolActor({
      state: this.context.state,
      emit: context.emit
    })
    this.viewportActor = new ViewportActor({
      state: this.context.state,
      emit: context.emit
    })
    this.mindmapActor = actors.mindmap

    this.registry.register({
      start: this.groupAutoFitActor.start,
      stop: this.groupAutoFitActor.stop
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
      start: this.mindmapActor.start,
      stop: this.mindmapActor.stop
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
      stop: this.context.shortcuts.dispose
    })
  }

  private applyConfig = (config: LifecycleConfig) => {
    this.context.state.write('tool', config.tool)
    this.context.viewport.setViewport(config.viewport)
    this.context.syncViewport()
    this.context.shortcuts.setShortcuts(config.shortcuts)
    this.context.state.write('mindmapLayout', config.mindmapLayout ?? {})
  }

  start: LifecycleApi['start'] = () => {
    if (this.started) return
    this.started = true

    this.registry.startAll()
  }

  update: LifecycleApi['update'] = (config) => {
    this.applyConfig(config)
    if (config.tool !== 'edge') {
      this.edgeActor.hoverCancel()
    }
  }

  stop: LifecycleApi['stop'] = () => {
    if (!this.started) return
    this.started = false

    this.registry.stopAll()
  }
}
