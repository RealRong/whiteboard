import { applyNodeDefaults, getMissingNodeFields } from '../schema'
import type {
  CoreResult,
  CoreRegistries,
  DispatchResult,
  Document,
  Node,
  NodeId,
  NodeInput,
  Operation,
  Size
} from '../types'
import { getNode, hasNode, listNodes } from '../types'

type NodeCreateOperationResult =
  CoreResult<{
    operation: Extract<Operation, { type: 'node.create' }>
  }>

type GroupOperationResult =
  CoreResult<{
    operations: Operation[]
  }>

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

export const createInvalidDispatchResult = (message: string): DispatchResult => ({
  ok: false,
  reason: 'invalid',
  message
})

export const buildNodeCreateOperation = ({
  payload,
  doc,
  registries,
  createNodeId
}: BuildNodeCreateOperationInput): NodeCreateOperationResult => {
  if (!payload.type) {
    return {
      ok: false,
      message: 'Missing node type.'
    }
  }
  if (!payload.position) {
    return {
      ok: false,
      message: 'Missing node position.'
    }
  }
  if (payload.id && hasNode(doc, payload.id)) {
    return {
      ok: false,
      message: `Node ${payload.id} already exists.`
    }
  }

  const typeDef = registries.nodeTypes.get(payload.type)
  if (typeDef?.validate && !typeDef.validate(payload.data)) {
    return {
      ok: false,
      message: `Node ${payload.type} validation failed.`
    }
  }

  const missing = getMissingNodeFields(payload, registries)
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing required fields: ${missing.join(', ')}.`
    }
  }

  const normalized = applyNodeDefaults(payload, registries)
  const id = normalized.id ?? createNodeId()
  const node: Node = {
    ...normalized,
    id,
    layer: normalized.type === 'group' ? (normalized.layer ?? 'background') : normalized.layer
  }

  return {
    ok: true,
    operation: {
      type: 'node.create',
      node
    }
  }
}

export const buildNodeGroupOperations = ({
  ids,
  doc,
  nodeSize,
  createGroupId
}: BuildNodeGroupOperationsInput): GroupOperationResult => {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) {
    return {
      ok: false,
      message: 'No node ids provided.'
    }
  }

  const nodes: Node[] = []
  for (const id of uniqueIds) {
    const node = getNode(doc, id)
    if (!node) {
      return {
        ok: false,
        message: `Node ${id} not found.`
      }
    }
    nodes.push(node)
  }

  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))
  const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? nodeSize.width)))
  const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? nodeSize.height)))
  const groupId = createGroupId()

  return {
    ok: true,
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
  }
}

export const buildNodeUngroupOperations = (
  id: NodeId,
  doc: Document
): GroupOperationResult => {
  if (!hasNode(doc, id)) {
    return {
      ok: false,
      message: `Node ${id} not found.`
    }
  }

  const childOperations = listNodes(doc)
    .filter((node) => node.parentId === id)
    .map((node) => ({
      type: 'node.update' as const,
      id: node.id,
      patch: { parentId: undefined }
    }))

  return {
    ok: true,
    operations: [
      ...childOperations,
      {
        type: 'node.delete',
        id
      }
    ]
  }
}
