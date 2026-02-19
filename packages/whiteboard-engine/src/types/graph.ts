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

export type GraphChange = {
  source?: GraphChangeSource
  dirtyNodeIds?: NodeId[]
  orderChanged?: true
  fullSync?: true
  visibleNodesChanged?: true
  canvasNodesChanged?: true
  visibleEdgesChanged?: true
}

export type GraphHint = {
  forceFull: boolean
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
}

export type GraphChangeSource = 'runtime' | 'doc'

export type GraphProjector = {
  read: () => GraphSnapshot
  readNode: (nodeId: NodeId) => Node | undefined
  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => GraphChange | undefined
  clearNodeOverrides: (ids?: NodeId[]) => GraphChange | undefined
  applyHint: (hint: GraphHint, source?: GraphChangeSource) => void
  reportDirty: (nodeIds: NodeId[], source?: GraphChangeSource) => void
  reportOrderChanged: (source?: GraphChangeSource) => void
  requestFullSync: () => void
  flush: (source: GraphChangeSource) => GraphChange | undefined
}

export type CreateGraphProjectorOptions = {
  getDoc: () => Document | null
}
