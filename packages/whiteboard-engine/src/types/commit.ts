import type {
  ChangeSet,
  DispatchFailure,
  Document
} from '@whiteboard/core/types'
import type { KernelReadImpact } from '@whiteboard/core/kernel'

export type Commit = {
  ok: true
  kind: 'apply' | 'undo' | 'redo' | 'replace'
  doc: Document
  changes: ChangeSet
  impact?: KernelReadImpact
}

export type CommitResult = Commit | DispatchFailure
