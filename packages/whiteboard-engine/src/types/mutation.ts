import type { DocumentId, Operation } from '@whiteboard/core/types'
import type { CommandSource } from './command'

export type Mutation = Operation

export type MutationBatch = {
  id: string
  docId?: DocumentId
  source: CommandSource
  actor?: string
  timestamp: number
  operations: Mutation[]
}
