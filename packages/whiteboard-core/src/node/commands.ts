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
import {
  filterRootIds,
  getNodeOwnerMap
} from './group'

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

const readChildren = (
  node: Pick<Node, 'children'> | undefined
): readonly NodeId[] => node?.children ?? []

const arraysEqual = (
  left: readonly NodeId[] | undefined,
  right: readonly NodeId[] | undefined
) => {
  if (left === right) {
    return true
  }

  const nextLeft = left ?? []
  const nextRight = right ?? []
  if (nextLeft.length !== nextRight.length) {
    return false
  }

  return nextLeft.every((id, index) => id === nextRight[index])
}

const replaceChildren = (
  current: readonly NodeId[],
  removeIds: ReadonlySet<NodeId>,
  insertedIds: readonly NodeId[]
) => {
  const firstIndex = current.findIndex((childId) => removeIds.has(childId))
  const next = current.filter((childId) => !removeIds.has(childId))

  if (firstIndex < 0) {
    return [
      ...next,
      ...insertedIds
    ]
  }

  return [
    ...next.slice(0, firstIndex),
    ...insertedIds,
    ...next.slice(firstIndex)
  ]
}

const toChildrenPatchOperation = (
  node: Node | undefined,
  children: readonly NodeId[]
): Extract<Operation, { type: 'node.update' }> | undefined => {
  if (!node || arraysEqual(node.children, children)) {
    return undefined
  }

  return {
    type: 'node.update',
    id: node.id,
    patch: {
      children: [...children]
    }
  }
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
  const {
    ownerId: _ownerId,
    ...nextNode
  } = normalized
  const id = nextNode.id ?? createNodeId()
  const node: Node = {
    ...nextNode,
    id,
    layer:
      nextNode.type === 'group' || nextNode.type === 'frame'
        ? (nextNode.layer ?? 'background')
        : nextNode.layer
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
  const orderedNodes = listNodes(doc)
  const rootIds = filterRootIds(orderedNodes, ids)
  if (!rootIds.length) {
    return err('invalid', 'No node ids provided.')
  }

  const nodes: Node[] = []
  for (const id of rootIds) {
    const node = getNode(doc, id)
    if (!node) {
      return err('invalid', `Node ${id} not found.`)
    }
    nodes.push(node)
  }

  const ownerByChildId = getNodeOwnerMap(orderedNodes)
  const directOwnerIds = rootIds.map((id) => ownerByChildId.get(id))
  const sharedOwnerId = directOwnerIds.every((ownerId) => ownerId === directOwnerIds[0])
    ? directOwnerIds[0]
    : undefined
  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))
  const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? nodeSize.width)))
  const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? nodeSize.height)))
  const groupId = createGroupId()
  const selectedIdSet = new Set(rootIds)
  const operations: Operation[] = [{
    type: 'node.create',
    node: {
      id: groupId,
      type: 'group',
      layer: 'background',
      position: { x: minX, y: minY },
      size: {
        width: Math.max(0, maxX - minX),
        height: Math.max(0, maxY - minY)
      },
      children: rootIds
    }
  }]

  if (sharedOwnerId) {
    const owner = getNode(doc, sharedOwnerId)
    const patch = toChildrenPatchOperation(
      owner,
      replaceChildren(readChildren(owner), selectedIdSet, [groupId])
    )
    if (patch) {
      operations.push(patch)
    }
  } else {
    const ownerIds = Array.from(new Set(directOwnerIds.filter((ownerId): ownerId is NodeId => Boolean(ownerId))))
    ownerIds.forEach((ownerId) => {
      const owner = getNode(doc, ownerId)
      const patch = toChildrenPatchOperation(
        owner,
        replaceChildren(readChildren(owner), selectedIdSet, [])
      )
      if (patch) {
        operations.push(patch)
      }
    })
  }

  return ok({
    groupId,
    operations
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
  const orderedNodes = listNodes(doc)
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) {
    return err('invalid', 'No group ids provided.')
  }

  const selectedSet = new Set(uniqueIds)
  const nodeById = new Map<NodeId, Node>(orderedNodes.map((node) => [node.id, node]))
  const ownerByChildId = new Map(getNodeOwnerMap(orderedNodes))
  const workingChildrenByOwner = new Map<NodeId, NodeId[]>()
  const groups: Node[] = []

  orderedNodes.forEach((node) => {
    if (node.children?.length) {
      workingChildrenByOwner.set(node.id, [...node.children])
    }
  })

  for (const id of uniqueIds) {
    const group = nodeById.get(id)
    if (!group) {
      return err('invalid', `Node ${id} not found.`)
    }
    if (group.type !== 'group') {
      return err('invalid', `Node ${id} is not a group.`)
    }
    groups.push(group)
  }

  const depthCache = new Map<NodeId, number>()
  const resolveDepth = (nodeId: NodeId): number => {
    const cached = depthCache.get(nodeId)
    if (cached !== undefined) {
      return cached
    }

    const ownerId = ownerByChildId.get(nodeId)
    const owner = ownerId ? nodeById.get(ownerId) : undefined
    const depth = owner?.type === 'group'
      ? resolveDepth(owner.id) + 1
      : 0
    depthCache.set(nodeId, depth)
    return depth
  }

  const deletedGroupIds = new Set<NodeId>()
  const nodeIds: NodeId[] = []
  const selectedNodeIds = new Set<NodeId>()

  groups
    .sort((left, right) => resolveDepth(right.id) - resolveDepth(left.id))
    .forEach((group) => {
      const currentChildren = [...(workingChildrenByOwner.get(group.id) ?? [])]
      const ownerId = ownerByChildId.get(group.id)

      if (ownerId) {
        const ownerChildren = workingChildrenByOwner.get(ownerId) ?? [...readChildren(nodeById.get(ownerId))]
        const nextOwnerChildren = replaceChildren(
          ownerChildren,
          new Set([group.id]),
          currentChildren
        )
        workingChildrenByOwner.set(ownerId, nextOwnerChildren)
        currentChildren.forEach((childId) => {
          ownerByChildId.set(childId, ownerId)
        })
      } else {
        currentChildren.forEach((childId) => {
          ownerByChildId.delete(childId)
        })
      }

      workingChildrenByOwner.delete(group.id)
      ownerByChildId.delete(group.id)
      deletedGroupIds.add(group.id)

      currentChildren.forEach((childId) => {
        if (deletedGroupIds.has(childId) || selectedNodeIds.has(childId)) {
          return
        }
        selectedNodeIds.add(childId)
        nodeIds.push(childId)
      })
    })

  const operations: Operation[] = []
  workingChildrenByOwner.forEach((children, ownerId) => {
    if (deletedGroupIds.has(ownerId)) {
      return
    }

    const patch = toChildrenPatchOperation(nodeById.get(ownerId), children)
    if (patch) {
      operations.push(patch)
    }
  })

  deletedGroupIds.forEach((groupId) => {
    operations.push({
      type: 'node.delete',
      id: groupId
    })
  })

  return ok({
    nodeIds,
    operations
  })
}
