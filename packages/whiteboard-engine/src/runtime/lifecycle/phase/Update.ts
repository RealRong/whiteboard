import type { LifecycleConfig } from '@engine-types/instance'
import type { ConfigApply } from './ConfigApply'
import type { RuntimeEffects } from './RuntimeEffects'

type UpdateOptions = {
  configApply: ConfigApply
  runtimeEffects: RuntimeEffects
}

export class Update {
  private configApply: ConfigApply
  private runtimeEffects: RuntimeEffects

  constructor(options: UpdateOptions) {
    this.configApply = options.configApply
    this.runtimeEffects = options.runtimeEffects
  }

  update = (config: LifecycleConfig, started: boolean) => {
    this.configApply.apply(config)
    this.runtimeEffects.sync(config, started)
  }
}
