import type { Edge, EdgeId, NodeId } from '../types/core'

export type EdgeRelations = {
  edgeById: Map<EdgeId, Edge>
  edgeIds: EdgeId[]
  nodeToEdgeIds: Map<NodeId, Set<EdgeId>>
}

const linkNodeEdge = (
  nodeToEdgeIds: Map<NodeId, Set<EdgeId>>,
  nodeId: NodeId,
  edgeId: EdgeId
) => {
  const edgeIds = nodeToEdgeIds.get(nodeId) ?? new Set<EdgeId>()
  edgeIds.add(edgeId)
  nodeToEdgeIds.set(nodeId, edgeIds)
}

export const createEdgeRelations = (edges: readonly Edge[]): EdgeRelations => {
  const edgeById = new Map<EdgeId, Edge>()
  const edgeIds: EdgeId[] = []
  const nodeToEdgeIds = new Map<NodeId, Set<EdgeId>>()

  edges.forEach((edge) => {
    edgeById.set(edge.id, edge)
    edgeIds.push(edge.id)
    linkNodeEdge(nodeToEdgeIds, edge.source.nodeId, edge.id)
    linkNodeEdge(nodeToEdgeIds, edge.target.nodeId, edge.id)
  })

  return {
    edgeById,
    edgeIds,
    nodeToEdgeIds
  }
}

export const collectRelatedEdgeIds = (
  nodeToEdgeIds: ReadonlyMap<NodeId, ReadonlySet<EdgeId>>,
  nodeIds: Iterable<NodeId>
) => {
  const edgeIds = new Set<EdgeId>()
  for (const nodeId of nodeIds) {
    nodeToEdgeIds.get(nodeId)?.forEach((edgeId) => {
      edgeIds.add(edgeId)
    })
  }
  return edgeIds
}
