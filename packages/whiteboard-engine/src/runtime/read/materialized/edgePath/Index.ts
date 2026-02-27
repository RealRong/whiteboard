import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'

export class Index {
  private edgeById = new Map<EdgeId, Edge>()
  private nodeToEdgeIds = new Map<NodeId, Set<EdgeId>>()
  private edgeOrderIds: EdgeId[] = []

  rebuild = (edges: Edge[]) => {
    const nextEdgeById = new Map<EdgeId, Edge>()
    const nextNodeToEdgeIds = new Map<NodeId, Set<EdgeId>>()
    const nextOrderIds: EdgeId[] = []

    edges.forEach((edge) => {
      nextEdgeById.set(edge.id, edge)
      nextOrderIds.push(edge.id)

      const sourceEdges = nextNodeToEdgeIds.get(edge.source.nodeId) ?? new Set<EdgeId>()
      sourceEdges.add(edge.id)
      nextNodeToEdgeIds.set(edge.source.nodeId, sourceEdges)

      const targetEdges = nextNodeToEdgeIds.get(edge.target.nodeId) ?? new Set<EdgeId>()
      targetEdges.add(edge.id)
      nextNodeToEdgeIds.set(edge.target.nodeId, targetEdges)
    })

    this.edgeById = nextEdgeById
    this.nodeToEdgeIds = nextNodeToEdgeIds
    this.edgeOrderIds = nextOrderIds
  }

  getEdge = (edgeId: EdgeId): Edge | undefined => this.edgeById.get(edgeId)

  getOrderIds = (): readonly EdgeId[] => this.edgeOrderIds

  collectEdgeIdsByNodeIds = (nodeIds: Iterable<NodeId>) => {
    const edgeIds = new Set<EdgeId>()
    for (const nodeId of nodeIds) {
      this.nodeToEdgeIds.get(nodeId)?.forEach((edgeId) => {
        edgeIds.add(edgeId)
      })
    }
    return edgeIds
  }
}
