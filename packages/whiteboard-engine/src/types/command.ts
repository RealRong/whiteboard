import type {
  DispatchResult,
  Document,
  DocumentId,
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch,
  Operation,
  Viewport
} from '@whiteboard/core'

export type CommandSource =
  | 'ui'
  | 'shortcut'
  | 'remote'
  | 'import'
  | 'system'
  | 'command'
  | 'interaction'

type CommandBase<TType extends string> = {
  type: TType
}

export type DocResetCommand = CommandBase<'doc.reset'> & {
  doc: Document
}

export type NodeCreateCommand = CommandBase<'node.create'> & {
  payload: NodeInput
}

export type NodeUpdateCommand = CommandBase<'node.update'> & {
  id: NodeId
  patch: NodePatch
}

export type NodeDeleteCommand = CommandBase<'node.delete'> & {
  ids: NodeId[]
}

export type EdgeCreateCommand = CommandBase<'edge.create'> & {
  payload: EdgeInput
}

export type EdgeUpdateCommand = CommandBase<'edge.update'> & {
  id: EdgeId
  patch: EdgePatch
}

export type EdgeDeleteCommand = CommandBase<'edge.delete'> & {
  ids: EdgeId[]
}

export type NodeOrderSetCommand = CommandBase<'node.order.set'> & {
  ids: NodeId[]
}

export type EdgeOrderSetCommand = CommandBase<'edge.order.set'> & {
  ids: EdgeId[]
}

export type ViewportSetCommand = CommandBase<'viewport.set'> & {
  viewport: Viewport
}

export type Command =
  | DocResetCommand
  | NodeCreateCommand
  | NodeUpdateCommand
  | NodeDeleteCommand
  | EdgeCreateCommand
  | EdgeUpdateCommand
  | EdgeDeleteCommand
  | NodeOrderSetCommand
  | EdgeOrderSetCommand
  | ViewportSetCommand

export type CommandBatch = {
  id: string
  docId?: DocumentId
  source: CommandSource
  actor?: string
  timestamp: number
  commands: Command[]
}

export type CommandBatchInput =
  | Command[]
  | ({
      commands: Command[]
    } & Partial<Pick<CommandBatch, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>)

export type ApplyOptions = Partial<Pick<CommandBatch, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>

export type MutationBatch = {
  id: string
  docId?: DocumentId
  source: CommandSource
  actor?: string
  timestamp: number
  operations: Operation[]
}

export type MutationBatchInput =
  | Operation[]
  | ({
      operations: Operation[]
    } & Partial<Pick<MutationBatch, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>)

export type ApplyMutationsOptions = Partial<Pick<MutationBatch, 'id' | 'docId' | 'source' | 'actor' | 'timestamp'>>

export type ApplyDispatchResult = {
  index: number
  type: Command['type']
  result: DispatchResult
}

export type ApplyMetrics = {
  durationMs: number
  commandCount: number
  dispatchCount: number
}

export type AppliedChangeSummary = {
  id: string
  docId?: DocumentId
  source: CommandSource
  actor?: string
  timestamp: number
  commandTypes: Command['type'][]
  operationTypes: string[]
  metrics: ApplyMetrics
}

export type ApplyResult = {
  commandBatch: CommandBatch
  dispatchResults: ApplyDispatchResult[]
  summary: AppliedChangeSummary
}

export type ApplyMutationsResult = {
  mutationBatch: MutationBatch
  dispatchResult: DispatchResult
  operations: Operation[]
  summary: AppliedChangeSummary
}

export type TxCollector = {
  add: (...commands: Command[]) => void
}

export type TxApi = <T>(
  run: (tx: TxCollector) => T | Promise<T>,
  options?: ApplyOptions
) => Promise<T>

export type ApplyApi = (
  input: CommandBatchInput,
  options?: ApplyOptions
) => Promise<ApplyResult>

export type ApplyMutationsApi = (
  input: MutationBatchInput,
  options?: ApplyMutationsOptions
) => Promise<ApplyMutationsResult>
