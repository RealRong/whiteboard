import type { Node, NodeId } from '@whiteboard/core/types'

export type NodeSummary = {
  ids: readonly NodeId[]
  count: number
  hasGroup: boolean
  lock: 'none' | 'mixed' | 'all'
}

const EMPTY_IDS: readonly NodeId[] = []

export const summarizeNodes = (
  nodes: readonly Node[]
): NodeSummary => {
  const ids = nodes.length > 0 ? nodes.map((node) => node.id) : EMPTY_IDS
  const count = ids.length
  const hasGroup = nodes.some((node) => node.type === 'group')
  const lockedCount = nodes.reduce(
    (total, node) => total + (node.locked ? 1 : 0),
    0
  )

  return {
    ids,
    count,
    hasGroup,
    lock:
      count === 0
        ? 'none'
        : lockedCount === count
          ? 'all'
          : lockedCount === 0
            ? 'none'
            : 'mixed'
  }
}
