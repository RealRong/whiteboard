import type {
  ChangeSet,
  Document,
  EdgeId,
  NodeId,
  Operation,
  Origin,
  Result,
  ResultCode
} from '../types'

export type KernelContext = {
  now?: () => number
  origin?: Origin
}

export type KernelReadImpact = {
  reset: boolean
  document: boolean
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

export type KernelReduceData = {
  doc: Document
  changes: ChangeSet
  inverse: readonly Operation[]
  read: KernelReadImpact
}

export type KernelReduceResult = Result<KernelReduceData, ResultCode>
