import type {
  Edge,
  Node,
  NodeId
} from '@whiteboard/core/types'

export type ReadModel = {
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
