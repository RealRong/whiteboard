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

export type KernelReadImpact = {
  reset: boolean
  node: {
    ids: readonly NodeId[]
    geometry: boolean
    list: boolean
    value: boolean
  }
  edge: {
    ids: readonly EdgeId[]
    nodeIds: readonly NodeId[]
    geometry: boolean
    list: boolean
    value: boolean
  }
  mindmap: {
    ids: readonly NodeId[]
    view: boolean
  }
}

export type KernelReduceResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse: readonly Operation[]
      read: KernelReadImpact
    }
  | DispatchFailure
