import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import type { Document, Edge, EdgeId, Node } from '@whiteboard/core/types'
import { EMPTY_EDGES, isSameNodeIdOrder, orderByIds } from './shared'

export const createVisibleEdgesAtom = (
  documentAtom: PrimitiveAtom<Document>,
  canvasNodesAtom: Atom<Node[]>
): Atom<Edge[]> => {
  type Cache = {
    edgesRef: Document['edges']
    edgeOrderRef: Document['order'] extends { edges?: infer TOrder }
      ? TOrder
      : EdgeId[] | undefined
    canvasNodes: Node[]
    visibleEdges: Edge[]
  }

  let cache: Cache | undefined

  return atom((get) => {
    const doc = get(documentAtom)
    const canvasNodes = get(canvasNodesAtom)

    if (!doc.edges.length || !canvasNodes.length) {
      cache = {
        edgesRef: doc.edges,
        edgeOrderRef: doc.order?.edges,
        canvasNodes,
        visibleEdges: EMPTY_EDGES
      }
      return EMPTY_EDGES
    }

    const edgeOrderRef = doc.order?.edges
    if (
      cache
      && cache.edgesRef === doc.edges
      && cache.edgeOrderRef === edgeOrderRef
      && isSameNodeIdOrder(cache.canvasNodes, canvasNodes)
    ) {
      return cache.visibleEdges
    }

    const edgeOrder = edgeOrderRef ?? doc.edges.map((edge) => edge.id)
    const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
    const edges = doc.edges.filter(
      (edge) =>
        canvasNodeIds.has(edge.source.nodeId)
        && canvasNodeIds.has(edge.target.nodeId)
    )
    const ordered = orderByIds(edges, edgeOrder)
    const visibleEdges = ordered.length ? ordered : EMPTY_EDGES

    cache = {
      edgesRef: doc.edges,
      edgeOrderRef,
      canvasNodes,
      visibleEdges
    }

    return visibleEdges
  })
}
