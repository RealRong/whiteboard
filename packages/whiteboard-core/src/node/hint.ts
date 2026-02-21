import type { Node, NodeId, NodePatch, Operation } from '../types'

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

export type NodePartialHint = {
  kind: 'partial'
  dirtyNodeIds?: NodeId[]
  orderChanged?: true
}

export type NodeFullHint = {
  kind: 'full'
}

export type NodeHint = NodePartialHint | NodeFullHint

type NodeCreateOperation = Extract<Operation, { type: 'node.create' }>
type NodeDeleteOperation = Extract<Operation, { type: 'node.delete' }>
type NodeUpdateOperation = Extract<Operation, { type: 'node.update' }>
type NodeOrderOperation = Extract<Operation, { type: 'node.order.set' }>

const NODE_ORDER_OPERATION_TYPES = new Set<Operation['type']>(['node.order.set'])

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

const hasGroupCollapsedPatch = (operation: NodeUpdateOperation) => {
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

export class NodeHintContext {
  private readonly dirtyNodeIds = new Set<NodeId>()
  private readonly subtreeCoveredNodeIds = new Set<NodeId>()
  private readonly ancestorGroupChainCache = new Map<NodeId, NodeId[]>()

  private nodes: Node[] | undefined
  private nodeById: Map<NodeId, Node> | undefined
  private childrenByParent: Map<NodeId, NodeId[]> | undefined

  private fullSyncRequested = false
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
    this.fullSyncRequested = true
  }

  isFullSyncRequested = () => this.fullSyncRequested

  buildHint = (): NodeHint => {
    if (this.fullSyncRequested) {
      return { kind: 'full' }
    }
    return {
      kind: 'partial',
      dirtyNodeIds: this.dirtyNodeIds.size
        ? Array.from(this.dirtyNodeIds)
        : undefined,
      orderChanged: this.orderChanged ? true : undefined
    }
  }
}

export type NodeHintRule = {
  canHandle: (operation: Operation) => boolean
  apply: (operation: Operation, context: NodeHintContext) => void
}

class UpdateRule implements NodeHintRule {
  canHandle = (operation: Operation): operation is NodeUpdateOperation =>
    operation.type === 'node.update'

  apply = (operation: Operation, context: NodeHintContext) => {
    if (!this.canHandle(operation)) return

    const nextNode = context.readNodeById().get(operation.id)
    if (hasTypePatch(operation.patch)) {
      const previousType = operation.before?.type
      const nextType =
        toNodeType(nextNode?.type) ?? toNodeType(operation.patch.type)
      if (!previousType || !nextType) {
        context.requestFullSync()
        return
      }
      if (previousType === nextType) {
        context.markNodeDirty(operation.id)
        return
      }

      const touchesGroup = previousType === 'group' || nextType === 'group'
      const touchesMindmap =
        previousType === 'mindmap' || nextType === 'mindmap'

      if (touchesGroup) {
        context.markSubtreeDirty(operation.id)
        context.markOrderChanged()
        return
      }

      context.markNodeDirty(operation.id)
      if (touchesMindmap) {
        context.markOrderChanged()
      }
      return
    }

    if (hasParentPatch(operation.patch)) {
      context.markSubtreeDirty(operation.id)
      context.markOrderChanged()
      return
    }

    if (hasGroupCollapsedPatch(operation)) {
      if (operation.before?.type === 'group' || nextNode?.type === 'group') {
        context.markSubtreeDirty(operation.id)
        context.markOrderChanged()
        return
      }
      context.markNodeDirty(operation.id)
      return
    }

    if (hasLayerPatch(operation.patch)) {
      context.markOrderChanged()
    }
    context.markNodeDirty(operation.id)
  }
}

class OrderRule implements NodeHintRule {
  canHandle = (operation: Operation): operation is NodeOrderOperation =>
    NODE_ORDER_OPERATION_TYPES.has(operation.type)

  apply = (operation: Operation, context: NodeHintContext) => {
    if (!this.canHandle(operation)) return

    context.markOrderChanged()
    operation.ids.forEach((nodeId) => {
      const node = context.readNodeById().get(nodeId)
      if (!node) return
      context.markAncestorGroupsDirty(node.parentId)
    })
  }
}

class CreateRule implements NodeHintRule {
  canHandle = (operation: Operation): operation is NodeCreateOperation =>
    operation.type === 'node.create'

  apply = (operation: Operation, context: NodeHintContext) => {
    if (!this.canHandle(operation)) return

    context.markOrderChanged()
    context.markNodeDirty(operation.node.id)
    context.markAncestorGroupsDirty(operation.node.parentId)
  }
}

class DeleteRule implements NodeHintRule {
  canHandle = (operation: Operation): operation is NodeDeleteOperation =>
    operation.type === 'node.delete'

  apply = (operation: Operation, context: NodeHintContext) => {
    if (!this.canHandle(operation)) return

    context.markOrderChanged()
    if (operation.before?.type === 'group') {
      context.markSubtreeDirty(operation.id)
    } else {
      context.markNodeDirty(operation.id)
    }
    context.markAncestorGroupsDirty(operation.before?.parentId)
  }
}

const DEFAULT_RULES: NodeHintRule[] = [
  new UpdateRule(),
  new OrderRule(),
  new CreateRule(),
  new DeleteRule()
]

export class NodeHintPipeline {
  constructor(private readonly rules: NodeHintRule[] = DEFAULT_RULES) {}

  run = (operations: Operation[], getNodes: () => Node[]): NodeHint => {
    const context = new NodeHintContext(getNodes)

    operations.forEach((operation) => {
      if (context.isFullSyncRequested()) return
      const rule = this.rules.find((item) => item.canHandle(operation))
      if (!rule) return
      rule.apply(operation, context)
    })

    return context.buildHint()
  }
}

const defaultNodeHintPipeline = new NodeHintPipeline()

export const hasNodeOperation = (operations: Operation[]) =>
  operations.some((operation) => operation.type.startsWith('node.'))

export const buildNodeHint = (operations: Operation[], getNodes: () => Node[]) =>
  defaultNodeHintPipeline.run(operations, getNodes)
