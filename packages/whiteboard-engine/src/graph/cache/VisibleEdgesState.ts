import type { Document, Edge, EdgeId, Node } from '@whiteboard/core'
import { EMPTY_EDGES, isSameNodeIdList, orderByIds } from './shared'

type VisibleEdgesCache = {
  edgesRef: Document['edges']
  edgeOrderRef: Document['order'] extends { edges?: infer TOrder }
    ? TOrder
    : EdgeId[] | undefined
  canvasNodes: Node[]
  visibleEdges: Edge[]
}

const deriveVisibleEdges = (doc: Document, canvasNodes: Node[]) => {
  if (!doc.edges.length || !canvasNodes.length) return EMPTY_EDGES
  const edgeOrder: EdgeId[] = doc.order?.edges ?? doc.edges.map((edge) => edge.id)
  const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
  const edges = doc.edges.filter(
    (edge) =>
      canvasNodeIds.has(edge.source.nodeId) &&
      canvasNodeIds.has(edge.target.nodeId)
  )
  return orderByIds(edges, edgeOrder)
}

export class VisibleEdgesState {
  private cache: VisibleEdgesCache | null = null

  reset = () => {
    this.cache = null
  }

  resolve = (doc: Document, canvasNodes: Node[]): Edge[] => {
    const edgeOrderRef = doc.order?.edges
    const cached = this.cache
    const visibleEdges =
      cached &&
      cached.edgesRef === doc.edges &&
      cached.edgeOrderRef === edgeOrderRef &&
      isSameNodeIdList(cached.canvasNodes, canvasNodes)
        ? cached.visibleEdges
        : deriveVisibleEdges(doc, canvasNodes)

    this.cache = {
      edgesRef: doc.edges,
      edgeOrderRef,
      canvasNodes,
      visibleEdges
    }
    return visibleEdges
  }

  syncVisibleEdgesRef = (visibleEdges: Edge[]) => {
    if (!this.cache || this.cache.visibleEdges === visibleEdges) return
    this.cache = {
      ...this.cache,
      visibleEdges
    }
  }
}
