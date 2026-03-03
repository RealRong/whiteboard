import type {
  DispatchResult,
  Operation
} from '@whiteboard/core/types'

export type CommandSource =
  | 'ui'
  | 'shortcut'
  | 'remote'
  | 'import'
  | 'system'
  | 'interaction'

export type Mutation = Operation

export type CommandTrace = {
  commandId?: string
  correlationId?: string
  transactionId?: string
  causationId?: string
  timestamp?: number
}

export type ApplyMutationsApi = (
  operations: Operation[],
  source: CommandSource,
  trace?: CommandTrace
) => Promise<DispatchResult>
