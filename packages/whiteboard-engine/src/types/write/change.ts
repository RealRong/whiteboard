import type { CommandSource } from '../command/source'
import type { ReadInvalidation } from '../read/invalidation'

export type ChangeTrace = {
  commandId: string
  source: CommandSource
}

export type Change = {
  trace: ChangeTrace
  readHints: ReadInvalidation
}

export type Bus = {
  publish: (change: Change) => void
  subscribe: (listener: (change: Change) => void) => () => void
}
