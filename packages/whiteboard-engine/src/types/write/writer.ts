import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { Store as DocumentStore } from '../document/store'

export type CommitSuccess = {
  ok: true
  doc: Document
  changes: ChangeSet
}

export type OperationsCommitSuccess = CommitSuccess & {
  inverse: readonly Operation[]
}

export type Options = {
  document: DocumentStore
  now?: () => number
}

export type OperationsCommitInput = {
  operations: readonly Operation[]
  origin: Origin
}

export type DocumentCommitInput = {
  doc: Document
  origin: Origin
  timestamp?: number
}

export type OperationsCommitResult =
  | OperationsCommitSuccess
  | DispatchFailure

export type DocumentCommitResult = CommitSuccess
