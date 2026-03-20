import { applyNodeDefaults, getMissingNodeFields } from '../schema'
import { getNodeAABB } from '../geometry'
import { err, ok } from '../types'
import type {
  CoreRegistries,
  Document,
  Node,
  NodeId,
  NodeInput,
  Operation,
  Result,
  Size
} from '../types'
import { getNode, hasNode, listNodes } from '../types'
import {
  alignNodes,
  distributeNodes,
  type NodeAlignMode,
  type NodeDistributeMode,
  type NodeLayoutEntry
} from './layout'

type NodeCreateOperationResult =
  Result<{
    operation: Extract<Operation, { type: 'node.create' }>
    nodeId: NodeId
  }, 'invalid'>

type NodeOperationsResult =
  Result<{
    operations: Operation[]
  }, 'invalid'>

type NodeGroupOperationResult =
  Result<{
    operations: Operation[]
    groupId: NodeId
  }, 'invalid'>

type NodeUngroupOperationResult =
  Result<{
    operations: Operation[]
    nodeIds: NodeId[]
  }, 'invalid'>

type BuildNodeCreateOperationInput = {
  payload: NodeInput
  doc: Document
  registries: CoreRegistries
  createNodeId: () => NodeId
}

type BuildNodeGroupOperationsInput = {
  ids: NodeId[]
  doc: Document
  nodeSize: Size
  createGroupId: () => NodeId
}

type BuildNodeLayoutOperationsInput = {
  ids: readonly NodeId[]
  doc: Document
  nodeSize: Size
}

const readLayoutEntries = ({
  ids,
  doc,
  nodeSize
}: BuildNodeLayoutOperationsInput): Result<{
  entries: NodeLayoutEntry[]
}, 'invalid'> => {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) {
    return err('invalid', 'No node ids provided.')
  }

  const entries: NodeLayoutEntry[] = []
  for (const id of uniqueIds) {
    const node = getNode(doc, id)
    if (!node) {
      return err('invalid', `Node ${id} not found.`)
    }

    entries.push({
      id: node.id,
      position: node.position,
      bounds: getNodeAABB(node, nodeSize)
    })
  }

  return ok({
    entries
  })
}

export const buildNodeCreateOperation = ({
  payload,
  doc,
  registries,
  createNodeId
}: BuildNodeCreateOperationInput): NodeCreateOperationResult => {
  if (!payload.type) {
    return err('invalid', 'Missing node type.')
  }
  if (!payload.position) {
    return err('invalid', 'Missing node position.')
  }
  if (payload.id && hasNode(doc, payload.id)) {
    return err('invalid', `Node ${payload.id} already exists.`)
  }

  const typeDef = registries.nodeTypes.get(payload.type)
  if (typeDef?.validate && !typeDef.validate(payload.data)) {
    return err('invalid', `Node ${payload.type} validation failed.`)
  }

  const missing = getMissingNodeFields(payload, registries)
  if (missing.length > 0) {
    return err('invalid', `Missing required fields: ${missing.join(', ')}.`)
  }

  const normalized = applyNodeDefaults(payload, registries)
  const id = normalized.id ?? createNodeId()
  const node: Node = {
    ...normalized,
    id,
    layer: normalized.type === 'group' ? (normalized.layer ?? 'background') : normalized.layer
  }

  return ok({
    nodeId: id,
    operation: {
      type: 'node.create',
      node
    }
  })
}

export const buildNodeGroupOperations = ({
  ids,
  doc,
  nodeSize,
  createGroupId
}: BuildNodeGroupOperationsInput): NodeGroupOperationResult => {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) {
    return err('invalid', 'No node ids provided.')
  }

  const nodes: Node[] = []
  for (const id of uniqueIds) {
    const node = getNode(doc, id)
    if (!node) {
      return err('invalid', `Node ${id} not found.`)
    }
    nodes.push(node)
  }

  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))
  const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? nodeSize.width)))
  const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? nodeSize.height)))
  const groupId = createGroupId()

  return ok({
    groupId,
    operations: [
      {
        type: 'node.create',
        node: {
          id: groupId,
          type: 'group',
          layer: 'background',
          position: { x: minX, y: minY },
          size: {
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY)
          }
        }
      },
      ...nodes.map((node) => ({
        type: 'node.update' as const,
        id: node.id,
        patch: { parentId: groupId }
      }))
    ]
  })
}

export const buildNodeAlignOperations = ({
  ids,
  doc,
  nodeSize,
  mode
}: BuildNodeLayoutOperationsInput & {
  mode: NodeAlignMode
}): NodeOperationsResult => {
  const entriesResult = readLayoutEntries({
    ids,
    doc,
    nodeSize
  })
  if (!entriesResult.ok) {
    return entriesResult
  }

  const updates = alignNodes(entriesResult.data.entries, mode)
  return ok({
    operations: updates.map((update) => ({
      type: 'node.update' as const,
      id: update.id,
      patch: {
        position: update.position
      }
    }))
  })
}

export const buildNodeDistributeOperations = ({
  ids,
  doc,
  nodeSize,
  mode
}: BuildNodeLayoutOperationsInput & {
  mode: NodeDistributeMode
}): NodeOperationsResult => {
  const entriesResult = readLayoutEntries({
    ids,
    doc,
    nodeSize
  })
  if (!entriesResult.ok) {
    return entriesResult
  }

  const updates = distributeNodes(entriesResult.data.entries, mode)
  return ok({
    operations: updates.map((update) => ({
      type: 'node.update' as const,
      id: update.id,
      patch: {
        position: update.position
      }
    }))
  })
}

export const buildNodeUngroupOperations = (
  id: NodeId,
  doc: Document
): NodeUngroupOperationResult => {
  return buildNodeUngroupManyOperations([id], doc)
}

export const buildNodeUngroupManyOperations = (
  ids: readonly NodeId[],
  doc: Document
): NodeUngroupOperationResult => {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) {
    return err('invalid', 'No group ids provided.')
  }

  const selectedSet = new Set(uniqueIds)
  const groups: Node[] = []

  for (const id of uniqueIds) {
    const group = getNode(doc, id)
    if (!group) {
      return err('invalid', `Node ${id} not found.`)
    }
    if (group.type !== 'group') {
      return err('invalid', `Node ${id} is not a group.`)
    }
    groups.push(group)
  }

  const childrenByParent = new Map<NodeId, Node[]>()
  listNodes(doc).forEach((node) => {
    if (!node.parentId) return
    const siblings = childrenByParent.get(node.parentId)
    if (siblings) {
      siblings.push(node)
      return
    }
    childrenByParent.set(node.parentId, [node])
  })

  const operations: Operation[] = []
  const nodeIds: NodeId[] = []
  const selectedNodeIds = new Set<NodeId>()

  for (const group of groups) {
    const children = childrenByParent.get(group.id) ?? []

    operations.push(
      ...children.map((node) => ({
        type: 'node.update' as const,
        id: node.id,
        patch: { parentId: undefined }
      })),
      {
        type: 'node.delete' as const,
        id: group.id
      }
    )

    children.forEach((child) => {
      const willBeDeleted = child.type === 'group' && selectedSet.has(child.id)
      if (willBeDeleted || selectedNodeIds.has(child.id)) {
        return
      }
      selectedNodeIds.add(child.id)
      nodeIds.push(child.id)
    })
  }

  return ok({
    nodeIds,
    operations
  })
}
