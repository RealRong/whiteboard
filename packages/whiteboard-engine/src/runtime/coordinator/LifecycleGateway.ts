import type {
  Lifecycle as LifecycleType,
  LifecycleConfig,
  LifecycleViewportConfig
} from '@engine-types/instance/lifecycle'
import { Lifecycle } from '../lifecycle/Lifecycle'
import type { CleanupActors } from '../lifecycle/Cleanup'
import type { LifecycleRuntimeContext } from '../common/contracts'
import type { Actor as MindmapActor } from '../actors/mindmap/Actor'

export type LifecycleRuntime = {
  context: LifecycleRuntimeContext
  cleanupActors: CleanupActors
  actors?: {
    mindmap?: MindmapActor
  }
}

export type LifecycleGatewayDependencies = {
  lifecycle: LifecycleRuntime
  onViewportConfigChange?: (viewportConfig: LifecycleViewportConfig) => void
}

export class LifecycleGateway {
  private readonly lifecycleRuntime: LifecycleType
  private started = false

  constructor({
    lifecycle,
    onViewportConfigChange
  }: LifecycleGatewayDependencies) {
    this.lifecycleRuntime = new Lifecycle(
      lifecycle.context,
      {
        onViewportConfigChange
      },
      lifecycle.cleanupActors,
      lifecycle.actors
    )
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.lifecycleRuntime.start()
  }

  update = (config: LifecycleConfig) => {
    this.lifecycleRuntime.update(config)
  }

  stop = () => {
    if (!this.started) return
    this.started = false
    this.lifecycleRuntime.stop()
  }

  lifecycle: LifecycleType = {
    start: () => this.start(),
    update: (config) => this.update(config),
    stop: () => this.stop()
  }
}
