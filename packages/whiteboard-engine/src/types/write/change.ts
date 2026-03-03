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
  trace: ChangeTrace
  readHints: ReadInvalidation
}

export type Bus = {
  publish: (change: Change) => void
  subscribe: (listener: (change: Change) => void) => () => void
}
