import type { Node, NodeId } from '@whiteboard/core/types'

export type NodeCaps = {
  nodeIds: readonly NodeId[]
  nodeCount: number
  hasGroup: boolean
  allLocked: boolean
  canDelete: boolean
  canDuplicate: boolean
  canGroup: boolean
  canUngroup: boolean
  canLock: boolean
  canUnlock: boolean
  lockLabel: string
}

const EMPTY_NODE_IDS: readonly NodeId[] = []

export const resolveNodeCaps = (
  nodes: readonly Node[]
): NodeCaps => {
  const nodeIds = nodes.length > 0 ? nodes.map((node) => node.id) : EMPTY_NODE_IDS
  const nodeCount = nodeIds.length
  const hasGroup = nodes.some((node) => node.type === 'group')
  const allLocked = nodeCount > 0 && nodes.every((node) => Boolean(node.locked))
  const multiple = nodeCount > 1

  return {
    nodeIds,
    nodeCount,
    hasGroup,
    allLocked,
    canDelete: nodeCount > 0,
    canDuplicate: nodeCount > 0,
    canGroup: nodeCount >= 2,
    canUngroup: hasGroup,
    canLock: nodeCount > 0 && !allLocked,
    canUnlock: allLocked,
    lockLabel: allLocked
      ? (multiple ? 'Unlock selected' : 'Unlock')
      : (multiple ? 'Lock selected' : 'Lock')
  }
}
