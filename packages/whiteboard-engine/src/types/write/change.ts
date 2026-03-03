import type { Document, Operation, Origin } from '@whiteboard/core/types'
import type { MutationImpact } from './mutation'
import type { CommandSource } from '../command/source'
import type { ReadInvalidation } from '../read/invalidation'

export type ChangeTrace = {
  commandId: string
  correlationId: string
  transactionId?: string
  causationId?: string
  source: CommandSource
}

export type Change = {
  revision: number
  kind: 'apply' | 'replace'
  origin: Origin
  trace: ChangeTrace
  readHints: ReadInvalidation
  operations: Operation[]
  impact: MutationImpact
  docBefore: Document
  docAfter: Document
}

export type Bus = {
  publish: (change: Change) => void
  subscribe: (listener: (change: Change) => void) => () => void
}
