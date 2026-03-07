import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Edge,
  EdgeId,
  EdgePatch,
  Node,
  NodeId,
  NodePatch,
  Operation,
  Origin,
  Viewport
} from '../types'
import {
  getEdge,
  getNode
} from '../types'
import type { MindmapId, MindmapTree } from '../mindmap/types'
import { getMindmapTreeFromNode } from '../mindmap/helpers'
import { createId } from '../utils'
import type {
  KernelContext,
  KernelProjectionInvalidation,
  KernelRebuild,
  KernelReduceResult
} from './types'

type InvalidationState = {
  full: boolean
  hasEdges: boolean
  hasOrder: boolean
  hasGeometry: boolean
  hasMindmap: boolean
  nodeIds: Set<NodeId>
  edgeIds: Set<EdgeId>
}

type ReduceDraft = {
  next: Document
  copied: {
    nodeEntities: boolean
    edgeEntities: boolean
    meta: boolean
  }
  invalidation: InvalidationState
  changes: Operation[]
  inverseGroups: Operation[][]
  timestamp: number
  origin?: Origin
}

const DEFAULT_MAX_OPERATIONS = 100
const DEFAULT_MAX_NODE_IDS = 200
const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []
const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
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

const normalizeMindmapTree = (
  id: MindmapId,
  tree: MindmapTree
): MindmapTree => (tree.id === id ? tree : { ...tree, id })

const classifyPatch = <TKey extends string>(
  keys: readonly TKey[],
  geometryKeys: ReadonlySet<TKey>,
  orderKeys: ReadonlySet<TKey>,
  styleKeys: ReadonlySet<TKey>
) => {
  if (!keys.length) {
    return {
      affectsGeometry: false,
      affectsOrder: false
    }
  }

  let affectsGeometry = false
  let affectsOrder = false
  let hasUnknownField = false

  for (const key of keys) {
    if (geometryKeys.has(key)) {
      affectsGeometry = true
      continue
    }
    if (orderKeys.has(key)) {
      affectsOrder = true
      continue
    }
    if (styleKeys.has(key)) continue
    hasUnknownField = true
  }

  if (hasUnknownField) {
    affectsGeometry = true
  }

  return {
    affectsGeometry,
    affectsOrder
  }
}

const classifyNodePatch = (patch: NodePatch) =>
  classifyPatch(
    Object.keys(patch) as Array<keyof NodePatch>,
    NODE_GEOMETRY_KEYS,
    NODE_ORDER_KEYS,
    NODE_STYLE_KEYS
  )

const classifyEdgePatch = (patch: EdgePatch) =>
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
}): KernelRebuild => {
  if (full) return 'full'
  if (dirty) return 'dirty'
  return 'none'
}

const createInvalidationState = (operationCount: number): InvalidationState => ({
  full: operationCount > DEFAULT_MAX_OPERATIONS,
  hasEdges: false,
  hasOrder: false,
  hasGeometry: false,
  hasMindmap: false,
  nodeIds: new Set<NodeId>(),
  edgeIds: new Set<EdgeId>()
})

const trackInvalidation = (
  state: InvalidationState,
  operation: Operation
) => {
  if (state.full) return

  if (operation.type === 'node.create') {
    state.hasOrder = true
    state.hasGeometry = true
    state.nodeIds.add(operation.node.id)
    return
  }

  if (operation.type === 'node.delete') {
    state.hasOrder = true
    state.hasGeometry = true
    state.nodeIds.add(operation.id)
    return
  }

  if (operation.type === 'node.update') {
    const patchClass = classifyNodePatch(operation.patch)
    if (patchClass.affectsOrder) {
      state.hasOrder = true
    }
    if (patchClass.affectsGeometry) {
      state.hasGeometry = true
      state.nodeIds.add(operation.id)
    }
    return
  }

  if (operation.type === 'node.order.set') {
    state.hasOrder = true
    return
  }

  if (operation.type === 'edge.create') {
    state.hasEdges = true
    state.hasOrder = true
    state.edgeIds.add(operation.edge.id)
    return
  }

  if (operation.type === 'edge.delete') {
    state.hasEdges = true
    state.hasOrder = true
    state.edgeIds.add(operation.id)
    return
  }

  if (operation.type === 'edge.update') {
    state.hasEdges = true
    const patchClass = classifyEdgePatch(operation.patch)
    if (patchClass.affectsOrder) {
      state.hasOrder = true
    }
    if (patchClass.affectsGeometry) {
      state.hasGeometry = true
      state.edgeIds.add(operation.id)
    }
    return
  }

  if (operation.type === 'edge.order.set') {
    state.hasEdges = true
    state.hasOrder = true
    return
  }

  if (operation.type === 'viewport.update') {
    return
  }

  if (operation.type.startsWith('mindmap.')) {
    state.hasMindmap = true
    if ('id' in operation && typeof operation.id === 'string') {
      state.nodeIds.add(operation.id)
    }
    return
  }

  state.full = true
}

const finalizeInvalidation = (
  state: InvalidationState
): KernelProjectionInvalidation => {
  if (state.full || state.nodeIds.size > DEFAULT_MAX_NODE_IDS) {
    return {
      index: {
        rebuild: 'full',
        nodeIds: EMPTY_NODE_IDS
      },
      edge: {
        rebuild: 'full',
        nodeIds: EMPTY_NODE_IDS,
        edgeIds: EMPTY_EDGE_IDS
      }
    }
  }

  if (state.hasMindmap) {
    state.hasGeometry = true
    state.hasOrder = true
  }

  const nodeIds = Array.from(state.nodeIds)
  const edgeIds = Array.from(state.edgeIds)

  return {
    index: {
      rebuild: toRebuild({
        full: state.hasOrder || state.hasMindmap,
        dirty: state.hasGeometry || nodeIds.length > 0
      }),
      nodeIds
    },
    edge: {
      rebuild: toRebuild({
        full: state.hasOrder || state.hasMindmap,
        dirty:
          state.hasEdges
          || state.hasGeometry
          || nodeIds.length > 0
          || edgeIds.length > 0
      }),
      nodeIds,
      edgeIds
    }
  }
}

const createDispatchFailure = (
  reason: DispatchFailure['reason'],
  message?: string
): DispatchFailure => ({
  ok: false,
  reason,
  message
})

const appendOrderId = <T extends string>(order: readonly T[], id: T): T[] =>
  order.includes(id) ? Array.from(order) : [...order, id]

const removeOrderId = <T extends string>(order: readonly T[], id: T): T[] => {
  const index = order.indexOf(id)
  if (index < 0) return Array.from(order)
  return [
    ...order.slice(0, index),
    ...order.slice(index + 1)
  ]
}

const touch = (draft: ReduceDraft) => {
  const iso = new Date(draft.timestamp).toISOString()
  if (!draft.copied.meta) {
    draft.next.meta = draft.next.meta ? { ...draft.next.meta } : undefined
    draft.copied.meta = true
  }
  if (!draft.next.meta) {
    draft.next.meta = { createdAt: iso, updatedAt: iso }
    return
  }
  if (!draft.next.meta.createdAt) {
    draft.next.meta.createdAt = iso
  }
  draft.next.meta.updatedAt = iso
}

const ensureNodeEntities = (draft: ReduceDraft): Document['nodes']['entities'] => {
  if (!draft.copied.nodeEntities) {
    draft.next.nodes = {
      ...draft.next.nodes,
      entities: { ...draft.next.nodes.entities }
    }
    draft.copied.nodeEntities = true
  }
  return draft.next.nodes.entities
}

const ensureEdgeEntities = (draft: ReduceDraft): Document['edges']['entities'] => {
  if (!draft.copied.edgeEntities) {
    draft.next.edges = {
      ...draft.next.edges,
      entities: { ...draft.next.edges.entities }
    }
    draft.copied.edgeEntities = true
  }
  return draft.next.edges.entities
}

const setNodeOrder = (
  draft: ReduceDraft,
  order: readonly NodeId[]
) => {
  draft.next.nodes = {
    ...draft.next.nodes,
    order: Array.from(order)
  }
}

const setEdgeOrder = (
  draft: ReduceDraft,
  order: readonly EdgeId[]
) => {
  draft.next.edges = {
    ...draft.next.edges,
    order: Array.from(order)
  }
}

const normalizeOperation = (
  document: Document,
  operation: Operation
): Operation => {
  switch (operation.type) {
    case 'node.update': {
      const current = getNode(document, operation.id)
      if (!operation.before && current) {
        return {
          ...operation,
          before: current
        }
      }
      return operation
    }
    case 'node.delete': {
      const current = getNode(document, operation.id)
      if (!operation.before && current) {
        return {
          ...operation,
          before: current
        }
      }
      return operation
    }
    case 'node.order.set': {
      if (!operation.before) {
        return {
          ...operation,
          before: [...document.nodes.order]
        }
      }
      return operation
    }
    case 'edge.update': {
      const current = getEdge(document, operation.id)
      if (!operation.before && current) {
        return {
          ...operation,
          before: current
        }
      }
      return operation
    }
    case 'edge.delete': {
      const current = getEdge(document, operation.id)
      if (!operation.before && current) {
        return {
          ...operation,
          before: current
        }
      }
      return operation
    }
    case 'edge.order.set': {
      if (!operation.before) {
        return {
          ...operation,
          before: [...document.edges.order]
        }
      }
      return operation
    }
    case 'mindmap.set': {
      const current = getMindmapTreeFromNode(getNode(document, operation.id))
      if (!operation.before && current) {
        return {
          ...operation,
          before: current
        }
      }
      return operation
    }
    case 'mindmap.delete': {
      const current = getMindmapTreeFromNode(getNode(document, operation.id))
      if (!operation.before && current) {
        return {
          ...operation,
          before: current
        }
      }
      return operation
    }
    case 'viewport.update': {
      if (!operation.before) {
        return {
          ...operation,
          before: document.viewport ?? DEFAULT_VIEWPORT
        }
      }
      return operation
    }
    default:
      return operation
  }
}

const buildInverse = (operation: Operation): Operation[] | null => {
  switch (operation.type) {
    case 'node.create': {
      return [{
        type: 'node.delete',
        id: operation.node.id
      }]
    }
    case 'node.update': {
      if (!operation.before) return null
      return [{
        type: 'node.update',
        id: operation.id,
        patch: operation.before as unknown as NodePatch
      }]
    }
    case 'node.delete': {
      if (!operation.before) return null
      return [{
        type: 'node.create',
        node: operation.before
      }]
    }
    case 'node.order.set': {
      if (!operation.before) return null
      return [{
        type: 'node.order.set',
        ids: operation.before
      }]
    }
    case 'edge.create': {
      return [{
        type: 'edge.delete',
        id: operation.edge.id
      }]
    }
    case 'edge.update': {
      if (!operation.before) return null
      return [{
        type: 'edge.update',
        id: operation.id,
        patch: operation.before as unknown as EdgePatch
      }]
    }
    case 'edge.delete': {
      if (!operation.before) return null
      return [{
        type: 'edge.create',
        edge: operation.before
      }]
    }
    case 'edge.order.set': {
      if (!operation.before) return null
      return [{
        type: 'edge.order.set',
        ids: operation.before
      }]
    }
    case 'mindmap.set': {
      if (!operation.before) {
        return [{
          type: 'mindmap.delete',
          id: operation.id
        }]
      }
      return [{
        type: 'mindmap.set',
        id: operation.id,
        tree: operation.before
      }]
    }
    case 'mindmap.delete': {
      if (!operation.before) return null
      return [{
        type: 'mindmap.set',
        id: operation.id,
        tree: operation.before
      }]
    }
    case 'viewport.update': {
      if (!operation.before) return null
      return [{
        type: 'viewport.update',
        after: operation.before
      }]
    }
    default:
      return null
  }
}

const applyOperation = (
  draft: ReduceDraft,
  operation: Operation
) => {
  switch (operation.type) {
    case 'node.create': {
      const entities = ensureNodeEntities(draft)
      entities[operation.node.id] = operation.node
      setNodeOrder(draft, appendOrderId(draft.next.nodes.order, operation.node.id))
      return
    }
    case 'node.update': {
      const current = getNode(draft.next, operation.id)
      if (!current) return
      const entities = ensureNodeEntities(draft)
      entities[operation.id] = {
        ...current,
        ...operation.patch
      }
      return
    }
    case 'node.delete': {
      if (!getNode(draft.next, operation.id)) return
      const entities = ensureNodeEntities(draft)
      delete entities[operation.id]
      setNodeOrder(draft, removeOrderId(draft.next.nodes.order, operation.id))
      return
    }
    case 'node.order.set': {
      setNodeOrder(draft, operation.ids)
      return
    }
    case 'edge.create': {
      const entities = ensureEdgeEntities(draft)
      entities[operation.edge.id] = operation.edge
      setEdgeOrder(draft, appendOrderId(draft.next.edges.order, operation.edge.id))
      return
    }
    case 'edge.update': {
      const current = getEdge(draft.next, operation.id)
      if (!current) return
      const entities = ensureEdgeEntities(draft)
      entities[operation.id] = {
        ...current,
        ...operation.patch
      }
      return
    }
    case 'edge.delete': {
      if (!getEdge(draft.next, operation.id)) return
      const entities = ensureEdgeEntities(draft)
      delete entities[operation.id]
      setEdgeOrder(draft, removeOrderId(draft.next.edges.order, operation.id))
      return
    }
    case 'edge.order.set': {
      setEdgeOrder(draft, operation.ids)
      return
    }
    case 'mindmap.set': {
      const tree = normalizeMindmapTree(operation.id, operation.tree)
      const existing = getNode(draft.next, operation.id)
      const position = tree.meta?.position ?? { x: 0, y: 0 }
      const entities = ensureNodeEntities(draft)

      if (!existing) {
        entities[operation.id] = {
          id: operation.id,
          type: 'mindmap',
          position,
          data: { mindmap: tree }
        }
        setNodeOrder(draft, appendOrderId(draft.next.nodes.order, operation.id))
        return
      }

      if (existing.type !== 'mindmap') return

      entities[operation.id] = {
        ...existing,
        position: existing.position ?? position,
        data: {
          ...(existing.data && typeof existing.data === 'object'
            ? (existing.data as Record<string, unknown>)
            : {}),
          mindmap: tree
        }
      }
      return
    }
    case 'mindmap.delete': {
      if (!getNode(draft.next, operation.id)) return
      const entities = ensureNodeEntities(draft)
      delete entities[operation.id]
      setNodeOrder(draft, removeOrderId(draft.next.nodes.order, operation.id))
      return
    }
    case 'viewport.update': {
      draft.next.viewport = operation.after
      return
    }
    default:
      return
  }
}

const createChangeSet = ({
  operations,
  timestamp,
  origin
}: {
  operations: ChangeSet['operations']
  timestamp: number
  origin?: Origin
}): ChangeSet => ({
  id: createId('change'),
  timestamp,
  operations,
  origin
})

export const reduceOperations = (
  document: Document,
  operations: readonly Operation[],
  context: KernelContext = {}
): KernelReduceResult => {
  if (operations.length === 0) {
    return createDispatchFailure('invalid', 'No operations to apply.')
  }

  const timestamp = (context.now ?? (() => Date.now()))()
  const draft: ReduceDraft = {
    next: {
      ...document,
      nodes: document.nodes,
      edges: document.edges,
      meta: document.meta,
      viewport: document.viewport,
      background: document.background
    },
    copied: {
      nodeEntities: false,
      edgeEntities: false,
      meta: false
    },
    invalidation: createInvalidationState(operations.length),
    changes: [],
    inverseGroups: [],
    timestamp,
    origin: context.origin ?? 'user'
  }

  for (const rawOperation of operations) {
    const operation = normalizeOperation(draft.next, rawOperation)
    const inverseOperations = buildInverse(operation)
    if (!inverseOperations) {
      return createDispatchFailure('invalid', 'Operation is not invertible.')
    }

    draft.changes.push(operation)
    draft.inverseGroups.push(inverseOperations)
    trackInvalidation(draft.invalidation, operation)
    applyOperation(draft, operation)
  }

  touch(draft)

  const inverse: Operation[] = []
  for (let index = draft.inverseGroups.length - 1; index >= 0; index -= 1) {
    inverse.push(...draft.inverseGroups[index])
  }

  return {
    ok: true,
    doc: draft.next,
    changes: createChangeSet({
      operations: draft.changes,
      timestamp: draft.timestamp,
      origin: draft.origin
    }),
    inverse,
    invalidation: finalizeInvalidation(draft.invalidation)
  }
}
