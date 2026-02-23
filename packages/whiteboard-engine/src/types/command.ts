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

export type ApplyMutationsApi = (
  operations: Operation[],
  source: CommandSource
) => Promise<DispatchResult>
