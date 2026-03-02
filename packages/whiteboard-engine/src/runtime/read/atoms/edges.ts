import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import { deriveVisibleEdges } from '@whiteboard/core/node'
import { isSameIdOrder } from '@whiteboard/core/utils'
import type {
  Document,
  Edge,
  EdgeId,
  Node
} from '@whiteboard/core/types'
import {
  EMPTY_EDGES
} from './shared'

export const visibleEdges = (
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
      cache &&
      cache.edgesRef === doc.edges &&
      cache.edgeOrderRef === edgeOrderRef &&
      isSameIdOrder(cache.canvasNodes, canvasNodes)
    ) {
      return cache.visibleEdges
    }

    const nextVisibleEdges = deriveVisibleEdges(
      doc.edges,
      canvasNodes,
      edgeOrderRef
    )
    const normalized = nextVisibleEdges.length ? nextVisibleEdges : EMPTY_EDGES

    cache = {
      edgesRef: doc.edges,
      edgeOrderRef,
      canvasNodes,
      visibleEdges: normalized
    }

    return normalized
  })
}
