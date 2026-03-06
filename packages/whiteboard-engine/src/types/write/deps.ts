import type { InternalInstance } from '../instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { ReadInvalidation } from '../read/invalidation'

export type WriteInstance = Pick<
  InternalInstance,
  'document' | 'config' | 'viewport' | 'registries'
>

export type Deps = {
  instance: WriteInstance
  scheduler: Scheduler
  applyInvalidation: (invalidation: ReadInvalidation) => void
  resetTransientState: () => void
  react: (invalidation: ReadInvalidation) => void
}
