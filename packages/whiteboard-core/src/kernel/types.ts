import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Edge,
  EdgeId,
  MindmapId,
  MindmapTree,
  Node,
  NodeId,
  Operation,
  Origin,
  Viewport
} from '../types'

export type KernelQuery = {
  document: () => Document
  node: {
    get: (id: NodeId) => Node | undefined
    list: () => Node[]
  }
  edge: {
    get: (id: EdgeId) => Edge | undefined
    list: () => Edge[]
    byNode: (id: NodeId) => Edge[]
  }
  mindmap: {
    get: (id: MindmapId) => MindmapTree | undefined
    list: () => MindmapTree[]
  }
  viewport: () => Viewport
}

export type KernelContext = {
  now?: () => number
  origin?: Origin
}

export type KernelInvertResult =
  | { ok: true; operations: readonly Operation[] }
  | DispatchFailure

export type KernelReduceResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse: readonly Operation[]
    }
  | DispatchFailure
