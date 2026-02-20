import type {
  Document,
  Edge,
  Node,
  NodeId,
  Point,
  Size
} from '@whiteboard/core'

export type NodeViewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
}

export type GraphSnapshot = {
  visibleNodes: Node[]
  canvasNodes: Node[]
  canvasNodeById: Map<NodeId, Node>
  visibleEdges: Edge[]
}

export type GraphProjectionChange = {
  visibleNodesChanged: boolean
  canvasNodesChanged: boolean
  visibleEdgesChanged: boolean
}

type GraphChangeBase = {
  source: GraphChangeSource
  projection: GraphProjectionChange
}

export type GraphPartialChange = GraphChangeBase & {
  kind: 'partial'
  dirtyNodeIds?: NodeId[]
  orderChanged?: true
}

export type GraphFullChange = GraphChangeBase & {
  kind: 'full'
}

export type GraphChange = GraphPartialChange | GraphFullChange

export type GraphPartialHint = {
  kind: 'partial'
  dirtyNodeIds?: NodeId[]
  orderChanged?: true
}

export type GraphFullHint = {
  kind: 'full'
}

export type GraphHint = GraphPartialHint | GraphFullHint

export type GraphChangeSource = 'runtime' | 'doc'

export type GraphProjector = {
  read: () => GraphSnapshot
  readNode: (nodeId: NodeId) => Node | undefined
  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => GraphChange | undefined
  clearNodeOverrides: (ids?: NodeId[]) => GraphChange | undefined
  applyHint: (hint: GraphHint, source?: GraphChangeSource) => void
  flush: (source: GraphChangeSource) => GraphChange | undefined
}

export type CreateGraphProjectorOptions = {
  getDoc: () => Document | null
}
