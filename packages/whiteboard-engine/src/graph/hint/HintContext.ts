import type { Node, NodeId } from '@whiteboard/core'
import type { Hint } from './types'

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

export class HintContext {
  private readonly dirtyNodeIds = new Set<NodeId>()
  private readonly subtreeCoveredNodeIds = new Set<NodeId>()
  private readonly ancestorGroupChainCache = new Map<NodeId, NodeId[]>()

  private nodes: Node[] | undefined
  private nodeById: Map<NodeId, Node> | undefined
  private childrenByParent: Map<NodeId, NodeId[]> | undefined

  private forceFull = false
  private orderChanged = false

  constructor(private readonly getNodes: () => Node[]) {}

  readNodes = () => {
    if (!this.nodes) {
      this.nodes = this.getNodes()
    }
    return this.nodes
  }

  readNodeById = () => {
    if (!this.nodeById) {
      this.nodeById = new Map(this.readNodes().map((node) => [node.id, node]))
    }
    return this.nodeById
  }

  private readChildrenByParent = () => {
    if (!this.childrenByParent) {
      this.childrenByParent = toNodeChildrenMap(this.readNodes())
    }
    return this.childrenByParent
  }

  markNodeDirty = (nodeId: NodeId) => {
    this.dirtyNodeIds.add(nodeId)
  }

  markSubtreeDirty = (nodeId: NodeId) => {
    if (this.subtreeCoveredNodeIds.has(nodeId)) {
      this.dirtyNodeIds.add(nodeId)
      return
    }
    this.dirtyNodeIds.add(nodeId)
    this.subtreeCoveredNodeIds.add(nodeId)
    const childrenMap = this.readChildrenByParent()
    const stack = [...(childrenMap.get(nodeId) ?? [])]
    while (stack.length) {
      const nextId = stack.pop()
      if (!nextId) continue
      if (this.subtreeCoveredNodeIds.has(nextId)) continue
      this.dirtyNodeIds.add(nextId)
      this.subtreeCoveredNodeIds.add(nextId)
      const children = childrenMap.get(nextId)
      if (!children?.length) continue
      children.forEach((childId) => stack.push(childId))
    }
  }

  markAncestorGroupsDirty = (parentId?: NodeId) => {
    if (!parentId) return

    const cached = this.ancestorGroupChainCache.get(parentId)
    if (cached) {
      cached.forEach((groupId) => this.dirtyNodeIds.add(groupId))
      return
    }

    const nodeMap = this.readNodeById()
    const ancestorGroups: NodeId[] = []
    let cursor: NodeId | undefined = parentId
    while (cursor) {
      const parent = nodeMap.get(cursor)
      if (!parent) break
      if (parent.type === 'group') {
        this.dirtyNodeIds.add(parent.id)
        ancestorGroups.push(parent.id)
      }
      cursor = parent.parentId
    }
    this.ancestorGroupChainCache.set(parentId, ancestorGroups)
  }

  markOrderChanged = () => {
    this.orderChanged = true
  }

  requestFullSync = () => {
    this.forceFull = true
  }

  isForceFull = () => this.forceFull

  buildHint = (): Hint => {
    if (this.forceFull) {
      return { forceFull: true }
    }
    if (this.dirtyNodeIds.size) {
      return {
        forceFull: false,
        dirtyNodeIds: Array.from(this.dirtyNodeIds),
        orderChanged: this.orderChanged ? true : undefined
      }
    }
    return {
      forceFull: false,
      orderChanged: this.orderChanged ? true : undefined
    }
  }
}
