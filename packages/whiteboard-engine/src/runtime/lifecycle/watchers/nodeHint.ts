import type { Node, NodeId, NodePatch, Operation } from '@whiteboard/core'

export type CanvasNodeDirtyHint = {
  forceFull: boolean
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
}

export const hasNodeOperation = (operations: Operation[]) =>
  operations.some((operation) => operation.type.startsWith('node.'))

const hasTypePatch = (patch: NodePatch) => 'type' in patch

const hasParentPatch = (patch: NodePatch) => 'parentId' in patch

const hasLayerPatch = (patch: NodePatch) => 'layer' in patch

const toNodeType = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const isGroupCollapsed = (data: unknown) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      (data as Record<string, unknown>).collapsed === true
  )

const hasCollapsedField = (data: unknown) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      'collapsed' in (data as Record<string, unknown>)
  )

const hasGroupCollapsedPatch = (
  operation: Extract<Operation, { type: 'node.update' }>
) => {
  if (!('data' in operation.patch)) return false

  if (operation.before?.type === 'group') {
    const previousCollapsed = isGroupCollapsed(operation.before.data)
    const nextCollapsed = isGroupCollapsed(operation.patch.data)
    return previousCollapsed !== nextCollapsed
  }

  if (!operation.before) {
    return hasCollapsedField(operation.patch.data)
  }

  return false
}

const toNodeChildrenMap = (nodes: Node[]) => {
  const childrenByParent = new Map<NodeId, NodeId[]>()
  nodes.forEach((node) => {
    if (!node.parentId) return
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node.id)
    childrenByParent.set(node.parentId, siblings)
  })
  return childrenByParent
}

export const buildCanvasNodeDirtyHint = (
  operations: Operation[],
  getNodes: () => Node[]
): CanvasNodeDirtyHint => {
  const dirtyNodeIds = new Set<NodeId>()
  const subtreeCoveredNodeIds = new Set<NodeId>()
  const ancestorGroupChainCache = new Map<NodeId, NodeId[]>()
  let nodes: Node[] | undefined
  let nodeById: Map<NodeId, Node> | undefined
  let childrenByParent: Map<NodeId, NodeId[]> | undefined
  let forceFull = false
  let orderChanged = false

  const readNodes = () => {
    if (!nodes) {
      nodes = getNodes()
    }
    return nodes
  }

  const readNodeById = () => {
    if (!nodeById) {
      nodeById = new Map(readNodes().map((node) => [node.id, node]))
    }
    return nodeById
  }

  const readChildrenByParent = () => {
    if (!childrenByParent) {
      childrenByParent = toNodeChildrenMap(readNodes())
    }
    return childrenByParent
  }

  const markSubtreeDirty = (nodeId: NodeId) => {
    if (subtreeCoveredNodeIds.has(nodeId)) {
      dirtyNodeIds.add(nodeId)
      return
    }
    dirtyNodeIds.add(nodeId)
    subtreeCoveredNodeIds.add(nodeId)
    const childrenMap = readChildrenByParent()
    const stack = [...(childrenMap.get(nodeId) ?? [])]
    while (stack.length) {
      const nextId = stack.pop()
      if (!nextId) continue
      if (subtreeCoveredNodeIds.has(nextId)) continue
      dirtyNodeIds.add(nextId)
      subtreeCoveredNodeIds.add(nextId)
      const children = childrenMap.get(nextId)
      if (!children?.length) continue
      children.forEach((childId) => stack.push(childId))
    }
  }

  const markAncestorGroupsDirty = (parentId?: NodeId) => {
    if (!parentId) return

    const cached = ancestorGroupChainCache.get(parentId)
    if (cached) {
      cached.forEach((groupId) => dirtyNodeIds.add(groupId))
      return
    }

    const nodeMap = readNodeById()
    const ancestorGroups: NodeId[] = []
    let cursor: NodeId | undefined = parentId
    while (cursor) {
      const parent = nodeMap.get(cursor)
      if (!parent) break
      if (parent.type === 'group') {
        dirtyNodeIds.add(parent.id)
        ancestorGroups.push(parent.id)
      }
      cursor = parent.parentId
    }
    ancestorGroupChainCache.set(parentId, ancestorGroups)
  }

  operations.forEach((operation) => {
    if (forceFull) return

    switch (operation.type) {
      case 'node.update': {
        const nextNode = readNodeById().get(operation.id)
        if (hasTypePatch(operation.patch)) {
          const previousType = operation.before?.type
          const nextType = toNodeType(nextNode?.type) ?? toNodeType(operation.patch.type)
          if (!previousType || !nextType) {
            forceFull = true
            return
          }
          if (previousType === nextType) {
            dirtyNodeIds.add(operation.id)
            return
          }

          const touchesGroup = previousType === 'group' || nextType === 'group'
          const touchesMindmap = previousType === 'mindmap' || nextType === 'mindmap'

          if (touchesGroup) {
            markSubtreeDirty(operation.id)
            orderChanged = true
            return
          }

          dirtyNodeIds.add(operation.id)
          if (touchesMindmap) {
            orderChanged = true
          }
          return
        }
        if (hasParentPatch(operation.patch)) {
          markSubtreeDirty(operation.id)
          orderChanged = true
          return
        }
        if (hasGroupCollapsedPatch(operation)) {
          if (operation.before?.type === 'group' || nextNode?.type === 'group') {
            markSubtreeDirty(operation.id)
            orderChanged = true
            return
          }
          dirtyNodeIds.add(operation.id)
          return
        }
        if (hasLayerPatch(operation.patch)) {
          orderChanged = true
        }
        dirtyNodeIds.add(operation.id)
        return
      }
      case 'node.order.set':
      case 'node.order.bringToFront':
      case 'node.order.sendToBack':
      case 'node.order.bringForward':
      case 'node.order.sendBackward': {
        orderChanged = true
        operation.ids.forEach((nodeId) => {
          const node = readNodeById().get(nodeId)
          if (!node) return
          markAncestorGroupsDirty(node.parentId)
        })
        return
      }
      case 'node.create': {
        orderChanged = true
        dirtyNodeIds.add(operation.node.id)
        markAncestorGroupsDirty(operation.node.parentId)
        return
      }
      case 'node.delete': {
        orderChanged = true
        if (operation.before?.type === 'group') {
          markSubtreeDirty(operation.id)
        } else {
          dirtyNodeIds.add(operation.id)
        }
        markAncestorGroupsDirty(operation.before?.parentId)
        return
      }
      default:
        return
    }
  })

  if (forceFull) {
    return { forceFull: true }
  }
  if (dirtyNodeIds.size) {
    return {
      forceFull: false,
      dirtyNodeIds: Array.from(dirtyNodeIds),
      orderChanged: orderChanged ? true : undefined
    }
  }
  return {
    forceFull: false,
    orderChanged: orderChanged ? true : undefined
  }
}
