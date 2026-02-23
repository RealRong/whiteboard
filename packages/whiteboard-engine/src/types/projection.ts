import type {
  Document,
  Edge,
  Node,
  NodeId,
  Point,
  Size
} from '@whiteboard/core/types'

export type NodeViewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
}

export type ProjectionSnapshot = {
  visibleNodes: Node[]
  canvasNodes: Node[]
  canvasNodeById: Map<NodeId, Node>
  visibleEdges: Edge[]
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
  orderChanged?: true
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
  orderChanged?: true
}

export type ProjectionStore = {
  read: () => ProjectionSnapshot
  readNode: (nodeId: NodeId) => Node | undefined
  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => ProjectionChange | undefined
  clearNodeOverrides: (ids?: NodeId[]) => ProjectionChange | undefined
  sync: (input?: ProjectionSyncInput) => ProjectionChange | undefined
}

export type CreateProjectionStoreOptions = {
  getDoc: () => Document | null
}
