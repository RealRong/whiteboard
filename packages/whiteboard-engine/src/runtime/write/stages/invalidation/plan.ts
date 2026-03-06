import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type { Rebuild } from '@engine-types/read/change'
import type {
  EdgeId,
  EdgePatch,
  NodeId,
  NodePatch,
  Operation
} from '@whiteboard/core/types'

type PatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

const EMPTY_READ_INVALIDATION: ReadInvalidation = {
  index: {
    rebuild: 'none',
    dirtyNodeIds: EMPTY_NODE_IDS
  },
  edge: {
    rebuild: 'none',
    dirtyNodeIds: EMPTY_NODE_IDS,
    dirtyEdgeIds: EMPTY_EDGE_IDS
  }
}

export const FULL_READ_INVALIDATION: ReadInvalidation = {
  index: {
    rebuild: 'full',
    dirtyNodeIds: EMPTY_NODE_IDS
  },
  edge: {
    rebuild: 'full',
    dirtyNodeIds: EMPTY_NODE_IDS,
    dirtyEdgeIds: EMPTY_EDGE_IDS
  }
}

const NODE_GEOMETRY_KEYS = new Set<keyof NodePatch>([
  'type',
  'position',
  'size',
  'rotation',
  'parentId'
])

const NODE_ORDER_KEYS = new Set<keyof NodePatch>([
  'layer',
  'zIndex'
])

const NODE_STYLE_KEYS = new Set<keyof NodePatch>([
  'locked',
  'data',
  'style'
])

const EDGE_GEOMETRY_KEYS = new Set<keyof EdgePatch>([
  'source',
  'target',
  'type',
  'routing'
])

const EDGE_ORDER_KEYS = new Set<keyof EdgePatch>([])

const EDGE_STYLE_KEYS = new Set<keyof EdgePatch>([
  'style',
  'label',
  'data'
])

const NODE_ORDER_TYPES = new Set<Operation['type']>([
  'node.order.set',
  'node.order.bringToFront',
  'node.order.sendToBack',
  'node.order.bringForward',
  'node.order.sendBackward'
])

const EDGE_ORDER_TYPES = new Set<Operation['type']>([
  'edge.order.set',
  'edge.order.bringToFront',
  'edge.order.sendToBack',
  'edge.order.bringForward',
  'edge.order.sendBackward'
])

const DEFAULT_MAX_OPERATIONS = 100
const DEFAULT_MAX_DIRTY_NODES = 200

const classifyPatch = <TKey extends string>(
  keys: readonly TKey[],
  geometryKeys: ReadonlySet<TKey>,
  orderKeys: ReadonlySet<TKey>,
  styleKeys: ReadonlySet<TKey>
): PatchClass => {
  if (!keys.length) {
    return {
      affectsGeometry: false,
      affectsOrder: false
    }
  }

  let affectsGeometry = false
  let affectsOrder = false
  let hasUnknownField = false

  keys.forEach((key) => {
    if (geometryKeys.has(key)) {
      affectsGeometry = true
      return
    }
    if (orderKeys.has(key)) {
      affectsOrder = true
      return
    }
    if (styleKeys.has(key)) return
    hasUnknownField = true
  })

  if (hasUnknownField) {
    affectsGeometry = true
  }

  return {
    affectsGeometry,
    affectsOrder
  }
}

const classifyNodePatch = (patch: NodePatch): PatchClass =>
  classifyPatch(
    Object.keys(patch) as Array<keyof NodePatch>,
    NODE_GEOMETRY_KEYS,
    NODE_ORDER_KEYS,
    NODE_STYLE_KEYS
  )

const classifyEdgePatch = (patch: EdgePatch): PatchClass =>
  classifyPatch(
    Object.keys(patch) as Array<keyof EdgePatch>,
    EDGE_GEOMETRY_KEYS,
    EDGE_ORDER_KEYS,
    EDGE_STYLE_KEYS
  )

const toRebuild = ({
  full,
  dirty
}: {
  full: boolean
  dirty: boolean
}): Rebuild => {
  if (full) return 'full'
  if (dirty) return 'dirty'
  return 'none'
}

export const planReadInvalidation = (
  operations: readonly Operation[],
  {
    maxOperations = DEFAULT_MAX_OPERATIONS,
    maxDirtyNodes = DEFAULT_MAX_DIRTY_NODES
  }: {
    maxOperations?: number
    maxDirtyNodes?: number
  } = {}
): ReadInvalidation => {
  if (!operations.length) {
    return EMPTY_READ_INVALIDATION
  }

  if (operations.length > maxOperations) {
    return FULL_READ_INVALIDATION
  }

  let hasEdges = false
  let hasOrder = false
  let hasGeometry = false
  let hasMindmap = false
  let full = false

  const dirtyNodeIds = new Set<NodeId>()
  const dirtyEdgeIds = new Set<EdgeId>()

  for (const operation of operations) {
    if (operation.type === 'node.create') {
      hasOrder = true
      hasGeometry = true
      dirtyNodeIds.add(operation.node.id)
      continue
    }

    if (operation.type === 'node.delete') {
      hasOrder = true
      hasGeometry = true
      dirtyNodeIds.add(operation.id)
      continue
    }

    if (operation.type === 'node.update') {
      const patchClass = classifyNodePatch(operation.patch)
      if (patchClass.affectsOrder) {
        hasOrder = true
      }
      if (patchClass.affectsGeometry) {
        hasGeometry = true
        dirtyNodeIds.add(operation.id)
      }
      continue
    }

    if (NODE_ORDER_TYPES.has(operation.type)) {
      hasOrder = true
      continue
    }

    if (operation.type === 'edge.create') {
      hasEdges = true
      hasOrder = true
      dirtyEdgeIds.add(operation.edge.id)
      continue
    }

    if (operation.type === 'edge.delete') {
      hasEdges = true
      hasOrder = true
      dirtyEdgeIds.add(operation.id)
      continue
    }

    if (operation.type === 'edge.update') {
      hasEdges = true
      const patchClass = classifyEdgePatch(operation.patch)
      if (patchClass.affectsOrder) {
        hasOrder = true
      }
      if (patchClass.affectsGeometry) {
        hasGeometry = true
        dirtyEdgeIds.add(operation.id)
      }
      continue
    }

    if (EDGE_ORDER_TYPES.has(operation.type)) {
      hasEdges = true
      hasOrder = true
      continue
    }

    if (operation.type === 'viewport.update') {
      continue
    }

    if (operation.type.startsWith('mindmap.')) {
      hasMindmap = true
      hasGeometry = true
      continue
    }

    full = true
    break
  }

  if (full || dirtyNodeIds.size > maxDirtyNodes) {
    return FULL_READ_INVALIDATION
  }

  const nextDirtyNodeIds = dirtyNodeIds.size
    ? Array.from(dirtyNodeIds)
    : EMPTY_NODE_IDS
  const nextDirtyEdgeIds = dirtyEdgeIds.size
    ? Array.from(dirtyEdgeIds)
    : EMPTY_EDGE_IDS

  return {
    index: {
      rebuild: toRebuild({
        full: hasOrder && !hasEdges || hasGeometry || hasMindmap,
        dirty: nextDirtyNodeIds.length > 0
      }),
      dirtyNodeIds: nextDirtyNodeIds
    },
    edge: {
      rebuild: toRebuild({
        full:
          hasEdges ||
          hasMindmap ||
          (hasGeometry && nextDirtyNodeIds.length === 0 && nextDirtyEdgeIds.length === 0),
        dirty: nextDirtyNodeIds.length > 0 || nextDirtyEdgeIds.length > 0
      }),
      dirtyNodeIds: nextDirtyNodeIds,
      dirtyEdgeIds: nextDirtyEdgeIds
    }
  }
}
