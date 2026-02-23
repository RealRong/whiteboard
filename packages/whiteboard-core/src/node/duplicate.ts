import type { Node, NodeId, NodeInput, Point } from '../types'
import { getGroupDescendants } from './group'

export const createNodeDuplicateInput = (
  node: Node,
  parentId: NodeId | undefined,
  delta: Point
): NodeInput => ({
  type: node.type,
  position: {
    x: node.position.x + delta.x,
    y: node.position.y + delta.y
  },
  size: node.size ? { width: node.size.width, height: node.size.height } : undefined,
  rotation: typeof node.rotation === 'number' ? node.rotation : undefined,
  layer: node.layer,
  zIndex: typeof node.zIndex === 'number' ? node.zIndex : undefined,
  locked: typeof node.locked === 'boolean' ? node.locked : undefined,
  data: node.data ? { ...node.data } : undefined,
  style: node.style ? { ...node.style } : undefined,
  parentId
})

export const expandNodeSelection = (nodes: Node[], selectedIds: NodeId[]) => {
  const nodeById = new Map<NodeId, Node>(nodes.map((node) => [node.id, node]))
  const expandedIds = new Set<NodeId>(selectedIds)

  selectedIds.forEach((id) => {
    const node = nodeById.get(id)
    if (node?.type !== 'group') return
    getGroupDescendants(nodes, id).forEach((child) => {
      expandedIds.add(child.id)
    })
  })

  return {
    nodeById,
    expandedIds
  }
}
