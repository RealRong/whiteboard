import type { Edge, Node, NodeId } from '@whiteboard/core/types'

export const EMPTY_NODES: Node[] = []
export const EMPTY_EDGES: Edge[] = []
export const EMPTY_NODE_MAP = new Map<NodeId, Node>()

export const isSameRefOrder = <T,>(left: readonly T[], right: readonly T[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const isSameNodeIdOrder = (left: readonly Node[], right: readonly Node[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.id !== right[index]?.id) return false
  }
  return true
}
