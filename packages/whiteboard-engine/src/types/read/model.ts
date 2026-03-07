import type {
  Document,
  Edge,
  Node,
  NodeId
} from '@whiteboard/core/types'

export type ReadModelSnapshot = {
  revision: number
  docId: Document['id'] | undefined
  nodes: {
    visible: Node[]
    canvas: Node[]
  }
  edges: {
    visible: Edge[]
  }
  indexes: {
    canvasNodeById: Map<NodeId, Node>
    canvasNodeIds: NodeId[]
  }
}
