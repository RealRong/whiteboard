import type { Edge, Node, NodeId } from '@whiteboard/core'

export const EMPTY_NODES: Node[] = []
export const EMPTY_EDGES: Edge[] = []
export const EMPTY_NODE_MAP = new Map<NodeId, Node>()

export const buildIndexById = (nodes: Node[]) => {
  const indexById = new Map<NodeId, number>()
  nodes.forEach((node, index) => {
    indexById.set(node.id, index)
  })
  return indexById
}

export const isSameRefList = <T,>(left: T[], right: T[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const isSameNodeIdList = (left: Node[], right: Node[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.id !== right[index]?.id) return false
  }
  return true
}

export const orderByIds = <T extends { id: string }>(items: T[], ids: string[]) => {
  if (!ids.length) return items

  if (ids.length === items.length) {
    let sameOrder = true
    for (let index = 0; index < items.length; index += 1) {
      if (items[index]?.id !== ids[index]) {
        sameOrder = false
        break
      }
    }
    if (sameOrder) return items
  }

  const map = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  const idSet = new Set(ids)

  ids.forEach((id) => {
    const item = map.get(id)
    if (item) ordered.push(item)
  })

  if (ordered.length === items.length) return ordered

  items.forEach((item) => {
    if (!idSet.has(item.id)) {
      ordered.push(item)
    }
  })

  return ordered
}

export const patchNodeListByIds = (
  list: Node[],
  changedNodeIds: Set<NodeId>,
  listIndexById: Map<NodeId, number>,
  readNodeById: (nodeId: NodeId) => Node | undefined
) => {
  if (!list.length || !changedNodeIds.size) return list
  let next = list
  changedNodeIds.forEach((nodeId) => {
    const index = listIndexById.get(nodeId)
    if (index === undefined) return
    const node = readNodeById(nodeId)
    if (!node) return
    if (next[index] === node) return
    if (next === list) {
      next = list.slice()
    }
    next[index] = node
  })
  return next
}
