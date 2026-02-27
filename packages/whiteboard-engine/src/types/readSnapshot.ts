import type {
  Document,
  Edge,
  Node,
  NodeId
} from '@whiteboard/core/types'

export type ReadModelNodesSlice = {
  visible: Node[]
  canvas: Node[]
}

export type ReadModelEdgesSlice = {
  visible: Edge[]
}

export type ReadModelMindmapSlice = {
  roots: NodeId[]
}

export type ReadModelIndexesSlice = {
  canvasNodeById: Map<NodeId, Node>
  visibleNodeIndexById: Map<NodeId, number>
  canvasNodeIndexById: Map<NodeId, number>
}

export type ReadModelSnapshot = {
  revision: number
  docId: Document['id'] | undefined
  nodes: ReadModelNodesSlice
  edges: ReadModelEdgesSlice
  mindmap: ReadModelMindmapSlice
  indexes: ReadModelIndexesSlice
}
