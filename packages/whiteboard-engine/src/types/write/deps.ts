import type { PrimitiveAtom } from 'jotai/vanilla'
import type { InternalInstance } from '../instance/engine'
import type { Scheduler } from '../../runtime/Scheduler'

export type WriteRuntimeInstance = Pick<
  InternalInstance,
  'state' | 'document' | 'config' | 'viewport' | 'registries' | 'query' | 'read'
> & {
  runtime: Pick<InternalInstance['runtime'], 'store'>
}

export type Deps = {
  instance: WriteRuntimeInstance
  scheduler: Scheduler
  readModelRevisionAtom: PrimitiveAtom<number>
}
