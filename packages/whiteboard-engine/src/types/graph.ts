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
  dirtyNodeIds?: NodeId[]
  orderChanged?: true
  fullSync?: true
  visibleNodesChanged?: true
  canvasNodesChanged?: true
  visibleEdgesChanged?: true
}

export type GraphChangeSource = 'runtime' | 'doc'

export type GraphProjector = {
  read: () => GraphSnapshot
  readNode: (nodeId: NodeId) => Node | undefined
  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => void
  clearNodeOverrides: (ids?: NodeId[]) => void
  watch: (listener: (payload: GraphChange) => void) => () => void
  reportDirty: (nodeIds: NodeId[], source?: GraphChangeSource) => void
  reportOrderChanged: (source?: GraphChangeSource) => void
  requestFullSync: () => void
  flush: (source: GraphChangeSource) => void
}

export type CreateGraphProjectorOptions = {
  getDoc: () => Document | null
}
