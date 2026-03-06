import type { CommandSource } from '../command/source'
import type { ReadInvalidation } from '../read/invalidation'

export type ChangeTrace = {
  commandId: string
  source: CommandSource
}

export type Change = {
  trace: ChangeTrace
  invalidation: ReadInvalidation
}

export type Subscribe = (listener: (change: Change) => void) => () => void

export type Bus = {
  publish: (change: Change) => void
  subscribe: Subscribe
}
