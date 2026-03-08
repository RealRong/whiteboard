import type { Document } from '@whiteboard/core/types'
import type { EngineContext } from '../instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { ReadImpact } from '../read/control/impact'

export type WriteInstance = Pick<
  EngineContext,
  'document' | 'config' | 'viewport' | 'registries'
>

export type WriteDeps = {
  instance: WriteInstance
  scheduler: Scheduler
  applyReadImpact: (impact: ReadImpact) => void
  notifyDocumentChange?: (doc: Document) => void
}
