import type { Edge, EdgeId, Node, NodeId } from '../types'

const EMPTY_EDGE_IDS: EdgeId[] = []

export const orderByIds = <T extends { id: string }>(
  items: T[],
  ids: readonly string[]
) => {
  if (!ids.length) return items

  if (items.length === ids.length) {
    let sameOrder = true
    for (let index = 0; index < items.length; index += 1) {
      if (items[index]?.id !== ids[index]) {
        sameOrder = false
        break
      }
    }
    if (sameOrder) return items
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  const idSet = new Set(ids)
  const ordered: T[] = []

  ids.forEach((id) => {
    const item = byId.get(id)
    if (item) {
      ordered.push(item)
    }
  })

  if (ordered.length === items.length) return ordered

  items.forEach((item) => {
    if (!idSet.has(item.id)) {
      ordered.push(item)
    }
  })

  return ordered
}

export const deriveVisibleEdges = (
  edges: readonly Edge[],
  canvasNodes: readonly Node[],
  edgeOrder: readonly EdgeId[] = EMPTY_EDGE_IDS
): Edge[] => {
  if (!edges.length || !canvasNodes.length) return []

  const orderedEdgeIds =
    edgeOrder.length ? edgeOrder : edges.map((edge) => edge.id)
  const canvasNodeIds = new Set<NodeId>(canvasNodes.map((node) => node.id))
  const visibleEdges = edges.filter(
    (edge) =>
      canvasNodeIds.has(edge.source.nodeId) &&
      canvasNodeIds.has(edge.target.nodeId)
  )

  return orderByIds(visibleEdges, orderedEdgeIds)
}

export const deriveMindmapRoots = (visibleNodes: readonly Node[]): NodeId[] => {
  if (!visibleNodes.length) return []
  return visibleNodes
    .filter((node) => node.type === 'mindmap')
    .map((node) => node.id)
}
