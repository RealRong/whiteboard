import type {
  ChangeSet,
  DispatchFailure,
  Document,
  EdgeId,
  NodeId,
  Operation,
  Origin
} from '../types'

export type KernelContext = {
  now?: () => number
  origin?: Origin
}

export type KernelRebuild = 'none' | 'dirty' | 'full'

export type KernelProjectionInvalidation = {
  index: {
    rebuild: KernelRebuild
    nodeIds: readonly NodeId[]
  }
  edge: {
    rebuild: KernelRebuild
    nodeIds: readonly NodeId[]
    edgeIds: readonly EdgeId[]
  }
}

export type KernelReduceResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse: readonly Operation[]
      invalidation: KernelProjectionInvalidation
    }
  | DispatchFailure
