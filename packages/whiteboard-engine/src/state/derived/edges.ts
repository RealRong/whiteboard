import { atom } from 'jotai'
import type { Edge } from '@whiteboard/core'
import { docAtom } from '../contextAtoms'
import { canvasNodesAtom } from './nodes'
import { edgeOrderAtom, orderByIds } from './order'

export const visibleEdgesAtom = atom<Edge[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []

  const canvasNodes = get(canvasNodesAtom)
  const edgeOrder = get(edgeOrderAtom)
  const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
  const edges = doc.edges.filter(
    (edge) =>
      canvasNodeIds.has(edge.source.nodeId) &&
      canvasNodeIds.has(edge.target.nodeId)
  )

  return orderByIds(edges, edgeOrder)
})
