import {
  expandContainerRect,
  rectEquals
} from '@whiteboard/core/node'
import { reduceOperations } from '@whiteboard/core/kernel'
import type {
  Document,
  Node,
  NodeId,
  Operation,
  Size
} from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../config'
import { NodeGeometryCache } from '../../geometry/nodeGeometry'

const readGroupPadding = (
  group: Pick<Node, 'data'>,
  defaultPadding: number
) => {
  const value = group.data?.padding
  return typeof value === 'number' ? value : defaultPadding
}

const isManualGroup = (
  group: Pick<Node, 'data'>
) => group.data?.autoFit === 'manual'

type GroupIndex = {
  groupIds: Set<NodeId>
  parentById: Map<NodeId, NodeId | undefined>
  childrenByParentId: Map<NodeId, Set<NodeId>>
  orderIndexById: Map<NodeId, number>
}

const createGroupIndex = (
  document: Document
): GroupIndex => {
  const index: GroupIndex = {
    groupIds: new Set(),
    parentById: new Map(),
    childrenByParentId: new Map(),
    orderIndexById: new Map()
  }
  fillGroupIndex(index, document)
  return index
}

const fillGroupIndex = (
  index: GroupIndex,
  document: Document
) => {
  index.groupIds.clear()
  index.parentById.clear()
  index.childrenByParentId.clear()
  index.orderIndexById.clear()

  const entities = document.nodes.entities
  for (const node of Object.values(entities)) {
    index.parentById.set(node.id, node.parentId)
    if (node.parentId) {
      const children = index.childrenByParentId.get(node.parentId) ?? new Set<NodeId>()
      children.add(node.id)
      index.childrenByParentId.set(node.parentId, children)
    }
    if (node.type === 'group') {
      index.groupIds.add(node.id)
    }
  }

  const order = document.nodes.order.length
    ? document.nodes.order
    : Object.keys(entities)
  order.forEach((id, position) => {
    index.orderIndexById.set(id, position)
  })
}

const collectDirtyGroups = (
  index: GroupIndex,
  nodeIds: Iterable<NodeId>
): Set<NodeId> => {
  const dirty = new Set<NodeId>()

  for (const nodeId of nodeIds) {
    let current: NodeId | undefined = nodeId
    while (current) {
      if (index.groupIds.has(current)) {
        dirty.add(current)
      }
      current = index.parentById.get(current)
    }
  }

  return dirty
}

const sortDirtyGroupsBottomUp = (
  groupIds: Iterable<NodeId>,
  index: GroupIndex
) => {
  const depthById = new Map<NodeId, number>()
  const resolveDepth = (groupId: NodeId): number => {
    const cached = depthById.get(groupId)
    if (cached !== undefined) return cached
    const parentId = index.parentById.get(groupId)
    const depth = parentId && index.groupIds.has(parentId)
      ? resolveDepth(parentId) + 1
      : 0
    depthById.set(groupId, depth)
    return depth
  }

  return [...groupIds].sort((left, right) => {
    const depthDiff = resolveDepth(right) - resolveDepth(left)
    if (depthDiff !== 0) return depthDiff
    return (index.orderIndexById.get(left) ?? 0) - (index.orderIndexById.get(right) ?? 0)
  })
}

const collectGroupOpsFromIndex = ({
  document,
  index,
  dirtyGroupIds,
  groupPadding,
  geometry
}: {
  document: Document
  index: GroupIndex
  dirtyGroupIds: ReadonlySet<NodeId>
  groupPadding: number
  geometry: NodeGeometryCache
}): Operation[] => {
  if (!dirtyGroupIds.size) return []

  const rectEpsilon = DEFAULT_TUNING.group.rectEpsilon
  const orderedGroupIds = sortDirtyGroupsBottomUp(dirtyGroupIds, index)
  const workingNodes: Record<NodeId, Node> = {
    ...document.nodes.entities
  }
  const operations: Operation[] = []

  for (const groupId of orderedGroupIds) {
    if (!index.groupIds.has(groupId)) continue
    const group = workingNodes[groupId]
    if (!group || group.type !== 'group') continue
    if (isManualGroup(group)) continue

    const childIds = index.childrenByParentId.get(groupId)
    if (!childIds || childIds.size === 0) continue

    const children = Array.from(childIds)
      .map((childId) => workingNodes[childId])
      .filter((node): node is Node => Boolean(node))
    if (!children.length) continue

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    children.forEach((child) => {
      geometry.update(child)
      const entry = geometry.get(child.id)
      const rect = entry?.aabb
      if (!rect) return
      minX = Math.min(minX, rect.x)
      minY = Math.min(minY, rect.y)
      maxX = Math.max(maxX, rect.x + rect.width)
      maxY = Math.max(maxY, rect.y + rect.height)
    })
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      continue
    }

    const contentRect = {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    }
    geometry.update(group)
    const groupEntry = geometry.get(group.id)
    const groupRect = groupEntry?.aabb
    if (!groupRect) continue

    const nextRect = expandContainerRect(
      groupRect,
      contentRect,
      readGroupPadding(group, groupPadding)
    )
    if (rectEquals(nextRect, groupRect, rectEpsilon)) continue

    const operation: Operation = {
      type: 'node.update',
      id: group.id,
      patch: {
        position: { x: nextRect.x, y: nextRect.y },
        size: { width: nextRect.width, height: nextRect.height }
      }
    }
    operations.push(operation)
    workingNodes[groupId] = {
      ...group,
      position: operation.patch.position!,
      size: operation.patch.size!
    }
    geometry.update(workingNodes[groupId])
  }

  return operations
}

export const collectGroupOps = ({
  document,
  nodeIds,
  nodeSize,
  groupPadding
}: {
  document: Document
  nodeIds: Iterable<NodeId>
  nodeSize: Size
  groupPadding: number
}): Operation[] => {
  const index = createGroupIndex(document)
  const dirtyGroupIds = collectDirtyGroups(index, nodeIds)
  if (!dirtyGroupIds.size) {
    return []
  }

  const geometry = new NodeGeometryCache(nodeSize)
  geometry.syncFull(Object.values(document.nodes.entities))

  return collectGroupOpsFromIndex({
    document,
    index,
    dirtyGroupIds,
    groupPadding,
    geometry
  })
}

export const normalizeGroups = ({
  document,
  nodeSize,
  groupPadding
}: {
  document: Document
  nodeSize: Size
  groupPadding: number
}): Document => {
  const nodeIds = Object.keys(document.nodes.entities)
  if (!nodeIds.length) {
    return document
  }

  const operations = collectGroupOps({
    document,
    nodeIds,
    nodeSize,
    groupPadding
  })
  if (!operations.length) {
    return document
  }

  const reduced = reduceOperations(document, operations, {
    origin: 'system',
    now: () => 0
  })
  return reduced.ok
    ? reduced.doc
    : document
}
