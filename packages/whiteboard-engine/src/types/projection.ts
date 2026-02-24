import type {
  Document,
  EdgeId,
  Edge,
  Node,
  NodeId,
  Operation,
  Point,
  Size
} from '@whiteboard/core/types'

export type ProjectionNodesSlice = {
  visible: Node[]
  canvas: Node[]
}

export type ProjectionEdgesSlice = {
  visible: Edge[]
}

export type ProjectionMindmapSlice = {
  roots: NodeId[]
}

export type ProjectionIndexesSlice = {
  canvasNodeById: Map<NodeId, Node>
  visibleNodeIndexById: Map<NodeId, number>
  canvasNodeIndexById: Map<NodeId, number>
}

export type NodeViewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
}

export type ProjectionSnapshot = {
  revision: number
  docId: Document['id'] | undefined
  nodes: ProjectionNodesSlice
  edges: ProjectionEdgesSlice
  mindmap: ProjectionMindmapSlice
  indexes: ProjectionIndexesSlice
}

export type ProjectionImpactTag =
  | 'full'
  | 'nodes'
  | 'edges'
  | 'order'
  | 'geometry'
  | 'mindmap'
  | 'viewport'

export type ProjectionImpact = {
  tags: ReadonlySet<ProjectionImpactTag>
  dirtyNodeIds?: readonly NodeId[]
  dirtyEdgeIds?: readonly EdgeId[]
}

export type ProjectionCommitKind = 'apply' | 'replace'

export type ProjectionApplyInput = {
  doc: Document
  operations: readonly Operation[]
  impact?: ProjectionImpact
}

export type ProjectionReplaceInput = {
  doc: Document
  impact?: ProjectionImpact
}

export type ProjectionCommit = {
  revision: number
  kind: ProjectionCommitKind
  snapshot: ProjectionSnapshot
  impact: ProjectionImpact
}

export type ProjectionStore = {
  getSnapshot: () => ProjectionSnapshot
  getRevision: () => number
  subscribe: (listener: (commit: ProjectionCommit) => void) => () => void
  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => ProjectionCommit | undefined
  clearNodeOverrides: (ids?: NodeId[]) => ProjectionCommit | undefined
  apply: (input: ProjectionApplyInput) => ProjectionCommit
  replace: (input: ProjectionReplaceInput) => ProjectionCommit
}

export type CreateProjectionStoreOptions = {
  getDoc: () => Document
}
