import type { Document, Node, NodeId, Operation } from '@whiteboard/core/types'
import type { KernelReadImpact } from '@whiteboard/core/kernel'

type TreeImpact = KernelReadImpact['tree']

type TreeDocIndex = {
  groups: Set<NodeId>
  parent: Map<NodeId, NodeId | undefined>
}

const EMPTY_TREE_IDS: readonly NodeId[] = []

const hasOwn = (target: object, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key)

const isCanvasNode = (node: Node | undefined) =>
  Boolean(node && node.type !== 'mindmap')

const isScopeRoot = (node: Node | undefined) =>
  node?.type === 'group'

const isCollapsed = (node: Node | undefined) =>
  Boolean(
    node?.type === 'group'
    && node.data
    && typeof node.data.collapsed === 'boolean'
    && node.data.collapsed
  )

const indexDocument = (document: Document): TreeDocIndex => {
  const groups = new Set<NodeId>()
  const parent = new Map<NodeId, NodeId | undefined>()

  Object.values(document.nodes.entities).forEach((node) => {
    parent.set(node.id, node.parentId)
    if (node.type === 'group') {
      groups.add(node.id)
    }
  })

  return { groups, parent }
}

const markAncestors = (
  dirty: Set<NodeId>,
  index: TreeDocIndex,
  parentId: NodeId | undefined
) => {
  let current = parentId
  while (current) {
    if (index.groups.has(current)) {
      dirty.add(current)
    }
    current = index.parent.get(current)
  }
}

const markAllRoots = (
  dirty: Set<NodeId>,
  index: TreeDocIndex
) => {
  index.groups.forEach((nodeId) => {
    dirty.add(nodeId)
  })
}

export const collectTreeImpact = ({
  before,
  after,
  operations
}: {
  before: Document
  after: Document
  operations: readonly Operation[]
}): TreeImpact => {
  const dirty = new Set<NodeId>()
  const beforeIndex = indexDocument(before)
  const afterIndex = indexDocument(after)
  let relation = false
  let order = false

  operations.forEach((operation) => {
    switch (operation.type) {
      case 'node.create': {
        const node = operation.node
        if (!isCanvasNode(node)) {
          return
        }

        relation = true
        markAncestors(dirty, afterIndex, node.parentId)
        if (isScopeRoot(node)) {
          dirty.add(node.id)
        }
        return
      }
      case 'node.delete': {
        const beforeNode = operation.before
        if (!isCanvasNode(beforeNode)) {
          return
        }

        relation = true
        markAncestors(dirty, beforeIndex, beforeNode?.parentId)
        if (isScopeRoot(beforeNode)) {
          dirty.add(operation.id)
        }
        return
      }
      case 'node.update': {
        const beforeNode = operation.before
        if (!beforeNode) {
          return
        }

        const afterNode = { ...beforeNode, ...operation.patch }
        const beforeCanvas = isCanvasNode(beforeNode)
        const afterCanvas = isCanvasNode(afterNode)
        const parentChanged = hasOwn(operation.patch, 'parentId')
        const typeChanged = hasOwn(operation.patch, 'type')
        const collapsedChanged = isCollapsed(beforeNode) !== isCollapsed(afterNode)
        const listChanged =
          parentChanged
          || typeChanged
          || beforeCanvas !== afterCanvas
          || collapsedChanged

        if (!listChanged) {
          return
        }

        relation = true

        if (beforeCanvas) {
          markAncestors(dirty, beforeIndex, beforeNode.parentId)
        }
        if (afterCanvas) {
          markAncestors(dirty, afterIndex, afterNode.parentId)
        }

        if (
          collapsedChanged
          || isScopeRoot(beforeNode) !== isScopeRoot(afterNode)
        ) {
          dirty.add(operation.id)
        }
        return
      }
      case 'node.order.set': {
        order = true
        markAllRoots(dirty, beforeIndex)
        markAllRoots(dirty, afterIndex)
        return
      }
      default:
        return
    }
  })

  return {
    ids: dirty.size > 0 ? Array.from(dirty) : EMPTY_TREE_IDS,
    relation,
    order
  }
}
