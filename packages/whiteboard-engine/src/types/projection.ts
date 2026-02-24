import type {
  Document,
  Edge,
  Node,
  NodeId,
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

export type ProjectionInvalidation = {
  visibleNodesChanged: boolean
  canvasNodesChanged: boolean
  visibleEdgesChanged: boolean
}

type ProjectionChangeBase = {
  source: ProjectionChangeSource
  projection: ProjectionInvalidation
}

export type ProjectionPartialChange = ProjectionChangeBase & {
  kind: 'partial'
  dirtyNodeIds?: NodeId[]
}

export type ProjectionFullChange = ProjectionChangeBase & {
  kind: 'full'
}

export type ProjectionChange = ProjectionPartialChange | ProjectionFullChange

export type ProjectionChangeSource = 'runtime' | 'doc'

export type ProjectionSyncInput = {
  source?: ProjectionChangeSource
  full?: boolean
  dirtyNodeIds?: readonly NodeId[]
}

export type ProjectionCommit = {
  snapshot: ProjectionSnapshot
  change: ProjectionChange
}

export type ProjectionStore = {
  get: () => ProjectionSnapshot
  subscribe: (listener: (commit: ProjectionCommit) => void) => () => void
  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => ProjectionCommit | undefined
  clearNodeOverrides: (ids?: NodeId[]) => ProjectionCommit | undefined
  apply: (input?: ProjectionSyncInput) => ProjectionCommit | undefined
  replace: (source?: ProjectionChangeSource) => ProjectionCommit
}

export type CreateProjectionStoreOptions = {
  getDoc: () => Document | null
}
