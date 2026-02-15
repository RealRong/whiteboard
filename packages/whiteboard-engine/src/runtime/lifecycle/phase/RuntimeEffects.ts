import type { Instance } from '@engine-types/instance'
import type { LifecycleConfig } from '@engine-types/instance'
import type { Bindings } from '../bindings'
import type { Container } from '../container'

type RuntimeEffectsOptions = {
  instance: Instance
  windowBindings: Bindings
  container: Container
}

export class RuntimeEffects {
  private instance: Instance
  private windowBindings: Bindings
  private container: Container

  constructor(options: RuntimeEffectsOptions) {
    this.instance = options.instance
    this.windowBindings = options.windowBindings
    this.container = options.container
  }

  sync = (config: LifecycleConfig, started: boolean) => {
    if (config.tool !== 'edge') {
      this.instance.runtime.services.edgeHover.cancel()
    }

    if (!started) return

    this.container.sync()
    this.windowBindings.sync()
  }
}
