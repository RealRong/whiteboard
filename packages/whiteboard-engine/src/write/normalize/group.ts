import {
  expandContainerRect,
  rectEquals
} from '@whiteboard/core/node'
import type { Document, Node, NodeId, Operation } from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../config'
import { NodeGeometryCache } from '../../geometry/nodeGeometry'
import type { Size } from '@engine-types/common'

const hasOwn = (target: object, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key)

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

export const shouldNormalizeOperations = (operations: readonly Operation[]): boolean => {
  for (const operation of operations) {
    switch (operation.type) {
      case 'node.create': {
        if (operation.node.parentId) {
          return true
        }
        break
      }
      case 'node.delete': {
        const before = operation.before
        if (!before) return true
        if (before.parentId || before.type === 'group') {
          return true
        }
        break
      }
      case 'node.update': {
        const patch = operation.patch
        const hasGeometryChange =
          hasOwn(patch, 'position') ||
          hasOwn(patch, 'size') ||
          hasOwn(patch, 'rotation')
        const hasRelationChange =
          hasOwn(patch, 'parentId') ||
          hasOwn(patch, 'type')

        if (hasRelationChange) {
          return true
        }
        if (!hasGeometryChange) {
          break
        }
        const before = operation.before
        if (!before) return true
        if (before.type === 'group' || before.parentId) {
          return true
        }
        break
      }
      default:
        break
    }
  }
  return false
}

export type GroupNormalizeIndex = {
  docRef?: Document
  groupIds: Set<NodeId>
  parentById: Map<NodeId, NodeId | undefined>
  childrenByParentId: Map<NodeId, Set<NodeId>>
  orderIndexById: Map<NodeId, number>
}

export const createGroupNormalizeIndex = (document: Document): GroupNormalizeIndex => {
  const index: GroupNormalizeIndex = {
    docRef: undefined,
    groupIds: new Set(),
    parentById: new Map(),
    childrenByParentId: new Map(),
    orderIndexById: new Map()
  }
  rebuildGroupNormalizeIndex(index, document)
  return index
}

export const rebuildGroupNormalizeIndex = (index: GroupNormalizeIndex, document: Document) => {
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

  index.docRef = document
}

const removeChild = (
  index: GroupNormalizeIndex,
  parentId: NodeId | undefined,
  nodeId: NodeId
) => {
  if (!parentId) return
  const children = index.childrenByParentId.get(parentId)
  if (!children) return
  children.delete(nodeId)
  if (children.size === 0) {
    index.childrenByParentId.delete(parentId)
  }
}

const addChild = (
  index: GroupNormalizeIndex,
  parentId: NodeId | undefined,
  nodeId: NodeId
) => {
  if (!parentId) return
  const children = index.childrenByParentId.get(parentId) ?? new Set<NodeId>()
  children.add(nodeId)
  index.childrenByParentId.set(parentId, children)
}

export const applyGroupNormalizeIndex = (
  index: GroupNormalizeIndex,
  operations: readonly Operation[],
  document: Document
) => {
  let orderDirty = false

  for (const operation of operations) {
    switch (operation.type) {
      case 'node.create': {
        const node = operation.node
        index.parentById.set(node.id, node.parentId)
        addChild(index, node.parentId, node.id)
        if (node.type === 'group') {
          index.groupIds.add(node.id)
        }
        orderDirty = true
        break
      }
      case 'node.delete': {
        const before = operation.before
        index.parentById.delete(operation.id)
        index.groupIds.delete(operation.id)
        index.childrenByParentId.delete(operation.id)
        removeChild(index, before?.parentId, operation.id)
        orderDirty = true
        break
      }
      case 'node.update': {
        const before = operation.before
        if (!before) break
        const after = { ...before, ...operation.patch }
        if (before.parentId !== after.parentId) {
          removeChild(index, before.parentId, operation.id)
          addChild(index, after.parentId, operation.id)
          index.parentById.set(operation.id, after.parentId)
        }
        if (before.type !== after.type) {
          if (before.type === 'group') {
            index.groupIds.delete(operation.id)
          }
          if (after.type === 'group') {
            index.groupIds.add(operation.id)
          }
        }
        break
      }
      case 'node.order.set': {
        orderDirty = true
        break
      }
      default:
        break
    }
  }

  if (orderDirty) {
    index.orderIndexById.clear()
    const order = document.nodes.order.length
      ? document.nodes.order
      : Object.keys(document.nodes.entities)
    order.forEach((id, position) => {
      index.orderIndexById.set(id, position)
    })
  }

  index.docRef = document
}

export const collectDirtyGroups = (
  operations: readonly Operation[],
  index: GroupNormalizeIndex,
  dirtyNodes?: Set<NodeId>
): Set<NodeId> => {
  const dirty = new Set<NodeId>()
  const markAncestors = (parentId: NodeId | undefined) => {
    let current = parentId
    while (current) {
      if (index.groupIds.has(current)) {
        dirty.add(current)
      }
      current = index.parentById.get(current)
    }
  }

  for (const operation of operations) {
    switch (operation.type) {
      case 'node.create': {
        const node = operation.node
        dirtyNodes?.add(node.id)
        if (node.type === 'group') {
          dirty.add(node.id)
        }
        markAncestors(node.parentId)
        break
      }
      case 'node.delete': {
        const before = operation.before
        dirtyNodes?.add(operation.id)
        if (before?.type === 'group') {
          dirty.add(operation.id)
        }
        markAncestors(before?.parentId)
        break
      }
      case 'node.update': {
        const before = operation.before
        const patch = operation.patch
        const hasGeometryChange =
          hasOwn(patch, 'position') ||
          hasOwn(patch, 'size') ||
          hasOwn(patch, 'rotation')
        const hasRelationChange =
          hasOwn(patch, 'parentId') ||
          hasOwn(patch, 'type')
        if (!before) break
        dirtyNodes?.add(operation.id)
        const after = { ...before, ...patch }

        if (before.type === 'group' || after.type === 'group' || hasRelationChange) {
          dirty.add(operation.id)
        }

        if (before.parentId !== after.parentId) {
          markAncestors(before.parentId)
          markAncestors(after.parentId)
          break
        }

        if (hasGeometryChange) {
          markAncestors(after.parentId ?? before.parentId)
        }
        break
      }
      default:
        break
    }
  }

  return dirty
}

const sortDirtyGroupsBottomUp = (
  groupIds: Iterable<NodeId>,
  index: GroupNormalizeIndex
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

export const buildNormalizeOperationsForGroups = ({
  document,
  index,
  dirtyGroupIds,
  groupPadding,
  geometry
}: {
  document: Document
  index: GroupNormalizeIndex
  dirtyGroupIds: Set<NodeId>
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

export type GroupNormalizer = {
  shouldNormalize: (operations: readonly Operation[]) => boolean
  ensure: (document: Document) => void
  analyze: (document: Document, operations: readonly Operation[]) => Set<NodeId>
  build: (document: Document, dirtyGroupIds: Set<NodeId>) => Operation[]
  sync: (document: Document, operations: readonly Operation[]) => void
  reset: (document: Document) => void
}

export const createGroupNormalizer = ({
  nodeSize,
  groupPadding
}: {
  nodeSize: Size
  groupPadding: number
}): GroupNormalizer => {
  let normalizeIndex: GroupNormalizeIndex | undefined
  let geometryCache: NodeGeometryCache | undefined
  let geometryDocRef: Document | undefined

  const ensureIndex = (document: Document) => {
    if (!normalizeIndex) {
      normalizeIndex = createGroupNormalizeIndex(document)
      return
    }
    if (normalizeIndex.docRef !== document) {
      rebuildGroupNormalizeIndex(normalizeIndex, document)
    }
  }

  const ensureGeometry = (document: Document) => {
    if (!geometryCache) {
      geometryCache = new NodeGeometryCache(nodeSize)
    }
    if (geometryDocRef !== document) {
      geometryCache.syncFull(Object.values(document.nodes.entities))
      geometryDocRef = document
    }
  }

  const ensure = (document: Document) => {
    ensureIndex(document)
    ensureGeometry(document)
  }

  const analyze = (document: Document, operations: readonly Operation[]): Set<NodeId> => {
    ensure(document)
    if (!normalizeIndex || !geometryCache) return new Set()

    applyGroupNormalizeIndex(normalizeIndex, operations, document)
    const dirtyNodes = new Set<NodeId>()
    const dirtyGroups = collectDirtyGroups(operations, normalizeIndex, dirtyNodes)
    if (dirtyNodes.size > 0) {
      geometryCache.syncByNodeIds(
        dirtyNodes,
        (nodeId) => document.nodes.entities[nodeId]
      )
    }
    geometryDocRef = document
    return dirtyGroups
  }

  const build = (document: Document, dirtyGroupIds: Set<NodeId>): Operation[] => {
    if (!normalizeIndex || !geometryCache) return []
    return buildNormalizeOperationsForGroups({
      document,
      index: normalizeIndex,
      dirtyGroupIds,
      groupPadding,
      geometry: geometryCache
    })
  }

  const sync = (document: Document, operations: readonly Operation[]) => {
    ensure(document)
    if (!normalizeIndex || !geometryCache) return
    applyGroupNormalizeIndex(normalizeIndex, operations, document)
    const dirtyNodes = new Set<NodeId>()
    collectDirtyGroups(operations, normalizeIndex, dirtyNodes)
    if (dirtyNodes.size > 0) {
      geometryCache.syncByNodeIds(
        dirtyNodes,
        (nodeId) => document.nodes.entities[nodeId]
      )
    }
    geometryDocRef = document
  }

  const reset = (document: Document) => {
    if (!normalizeIndex) {
      normalizeIndex = createGroupNormalizeIndex(document)
    } else {
      rebuildGroupNormalizeIndex(normalizeIndex, document)
    }
    if (!geometryCache) {
      geometryCache = new NodeGeometryCache(nodeSize)
    }
    geometryCache.syncFull(Object.values(document.nodes.entities))
    geometryDocRef = document
  }

  return {
    shouldNormalize: shouldNormalizeOperations,
    ensure,
    analyze,
    build,
    sync,
    reset
  }
}
