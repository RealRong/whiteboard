import type { InternalInstance } from '../instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { ReadImpact } from '../read/impact'

export type WriteInstance = Pick<
  InternalInstance,
  'document' | 'config' | 'viewport' | 'registries'
>

export type Deps = {
  instance: WriteInstance
  scheduler: Scheduler
  read: (impact: ReadImpact) => void
  resetTransientState: () => void
  react: (impact: ReadImpact) => void
}
