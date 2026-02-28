import type { Edge, Node, NodeId } from '@whiteboard/core/types'

export const EMPTY_NODES: Node[] = []
export const EMPTY_EDGES: Edge[] = []
export const EMPTY_NODE_IDS: NodeId[] = []
export const EMPTY_NODE_MAP = new Map<NodeId, Node>()
export const EMPTY_INDEX_BY_ID = new Map<NodeId, number>()

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

export const isSameIdOrder = (left: readonly NodeId[], right: readonly NodeId[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const orderByIds = <T extends { id: string }>(items: T[], ids: readonly string[]) => {
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

export const buildIndexById = (nodes: readonly Node[]) => {
  const byId = new Map<NodeId, number>()
  nodes.forEach((node, index) => {
    byId.set(node.id, index)
  })
  return byId
}
