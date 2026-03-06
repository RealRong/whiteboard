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
  | 'history'
  | 'interaction'

export type Mutation = Operation

export type ApplyMutationsApi = (
  operations: readonly Operation[],
  source: CommandSource
) => Promise<DispatchResult>
