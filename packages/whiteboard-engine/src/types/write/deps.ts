import type { PrimitiveAtom } from 'jotai/vanilla'
import type { InternalInstance } from '../instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { ReadInvalidation } from '../read/invalidation'

export type WriteInstance = Pick<
  InternalInstance,
  'state' | 'document' | 'config' | 'viewport' | 'registries' | 'query' | 'read'
> & {
  runtime: Pick<InternalInstance['runtime'], 'store'>
}

export type Deps = {
  instance: WriteInstance
  scheduler: Scheduler
  readModelRevisionAtom: PrimitiveAtom<number>
  project: (invalidation: ReadInvalidation) => void
}
