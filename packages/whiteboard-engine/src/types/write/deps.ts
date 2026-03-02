import type { PrimitiveAtom } from 'jotai/vanilla'
import type { Document } from '@whiteboard/core/types'
import type { InternalInstance } from '../instance/engine'
import type { Scheduler } from '../../runtime/Scheduler'

export type Deps = {
  instance: InternalInstance
  scheduler: Scheduler
  documentAtom: PrimitiveAtom<Document>
  readModelRevisionAtom: PrimitiveAtom<number>
}
