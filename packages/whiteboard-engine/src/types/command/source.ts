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
}

export type ApplyMutationsApi = (
  operations: readonly Operation[],
  source: CommandSource,
  trace?: CommandTrace
) => Promise<DispatchResult>
