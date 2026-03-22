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
  Origin
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
  KernelReadImpact,
  KernelReduceResult
} from './types'

type NodeImpactState = {
  ids: Set<NodeId>
  geometry: boolean
  list: boolean
  value: boolean
}

type EdgeImpactState = {
  ids: Set<EdgeId>
  nodeIds: Set<NodeId>
  geometry: boolean
  list: boolean
  value: boolean
}

type MindmapImpactState = {
  ids: Set<NodeId>
  view: boolean
}

type ReadImpactState = {
  full: boolean
  document: boolean
  node: NodeImpactState
  edge: EdgeImpactState
  mindmap: MindmapImpactState
}

type ReduceDraft = {
  next: Document
  copied: {
    nodeEntities: boolean
    edgeEntities: boolean
    meta: boolean
  }
  read: ReadImpactState
  changes: Operation[]
  inverseGroups: Operation[][]
  timestamp: number
  origin?: Origin
}

type NodePatchImpact = {
  geometry: boolean
  list: boolean
  value: boolean
}

type EdgePatchImpact = {
  geometry: boolean
  value: boolean
}

const DEFAULT_MAX_OPERATIONS = 100
const DEFAULT_MAX_IDS = 200
const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

const NODE_GEOMETRY_KEYS = new Set<keyof NodePatch>([
  'position',
  'size',
  'rotation'
])

const NODE_LIST_KEYS = new Set<keyof NodePatch>([
  'type',
  'layer',
  'zIndex',
  'parentId'
])

const NODE_VALUE_KEYS = new Set<keyof NodePatch>([
  'data',
  'locked',
  'style'
])

const EDGE_GEOMETRY_KEYS = new Set<keyof EdgePatch>([
  'source',
  'target',
  'type',
  'path'
])

const EDGE_VALUE_KEYS = new Set<keyof EdgePatch>([
  'style',
  'label',
  'data'
])

const normalizeMindmapTree = (
  id: MindmapId,
  tree: MindmapTree
): MindmapTree => (tree.id === id ? tree : { ...tree, id })

const isMindmapNode = (node: Node | undefined) =>
  node?.type === 'mindmap'

const isCanvasNode = (node: Node | undefined) =>
  Boolean(node && node.type !== 'mindmap')

const getCollapsed = (node: Node | undefined) =>
  Boolean(
    node?.type === 'group' &&
    node.data &&
    typeof node.data.collapsed === 'boolean' &&
    node.data.collapsed
  )

const addNodeId = (ids: Set<NodeId>, id: NodeId) => {
  ids.add(id)
}

const addEdgeId = (ids: Set<EdgeId>, id: EdgeId) => {
  ids.add(id)
}

const markMindmapView = (
  state: MindmapImpactState,
  id: NodeId
) => {
  state.ids.add(id)
  state.view = true
}

const classifyNodePatch = (patch: NodePatch): NodePatchImpact => {
  const impact: NodePatchImpact = {
    geometry: false,
    list: false,
    value: false
  }

  for (const key of Object.keys(patch) as Array<keyof NodePatch>) {
    if (NODE_GEOMETRY_KEYS.has(key)) {
      impact.geometry = true
      continue
    }
    if (NODE_LIST_KEYS.has(key)) {
      impact.list = true
      continue
    }
    if (NODE_VALUE_KEYS.has(key)) {
      impact.value = true
      continue
    }
    impact.geometry = true
    impact.list = true
    impact.value = true
  }

  return impact
}

const classifyEdgePatch = (patch: EdgePatch): EdgePatchImpact => {
  const impact: EdgePatchImpact = {
    geometry: false,
    value: false
  }

  for (const key of Object.keys(patch) as Array<keyof EdgePatch>) {
    if (EDGE_GEOMETRY_KEYS.has(key)) {
      impact.geometry = true
      continue
    }
    if (EDGE_VALUE_KEYS.has(key)) {
      impact.value = true
      continue
    }
    impact.geometry = true
    impact.value = true
  }

  return impact
}

const createReadImpactState = (operationCount: number): ReadImpactState => ({
  full: operationCount > DEFAULT_MAX_OPERATIONS,
  document: false,
  node: {
    ids: new Set<NodeId>(),
    geometry: false,
    list: false,
    value: false
  },
  edge: {
    ids: new Set<EdgeId>(),
    nodeIds: new Set<NodeId>(),
    geometry: false,
    list: false,
    value: false
  },
  mindmap: {
    ids: new Set<NodeId>(),
    view: false
  }
})

const trackReadImpact = (
  state: ReadImpactState,
  operation: Operation
) => {
  if (state.full) return

  switch (operation.type) {
    case 'document.update': {
      state.document = true
      return
    }
    case 'node.create': {
      if (isMindmapNode(operation.node)) {
        markMindmapView(state.mindmap, operation.node.id)
        return
      }

      const { node } = state
      node.geometry = true
      node.list = true
      node.value = true
      addNodeId(node.ids, operation.node.id)
      return
    }
    case 'node.delete': {
      if (isMindmapNode(operation.before)) {
        markMindmapView(state.mindmap, operation.id)
        return
      }

      const { node } = state
      node.geometry = true
      node.list = true
      node.value = true
      addNodeId(node.ids, operation.id)
      return
    }
    case 'node.update': {
      const patch = classifyNodePatch(operation.patch)
      const before = operation.before
      const after = before
        ? { ...before, ...operation.patch }
        : undefined
      const beforeIsMindmap = isMindmapNode(before)
      const afterIsMindmap = isMindmapNode(after)
      const beforeIsCanvas = isCanvasNode(before)
      const afterIsCanvas = isCanvasNode(after)
      const collapsedChanged = getCollapsed(before) !== getCollapsed(after)
      const nodeList = patch.list || beforeIsCanvas !== afterIsCanvas || collapsedChanged
      const nodeChanged = patch.geometry || nodeList || patch.value

      if (beforeIsCanvas || afterIsCanvas) {
        const { node } = state
        node.geometry ||= patch.geometry
        node.list ||= nodeList
        node.value ||= patch.value
        if (nodeChanged) {
          addNodeId(node.ids, operation.id)
        }
      }

      if (beforeIsMindmap || afterIsMindmap) {
        markMindmapView(state.mindmap, before?.id ?? operation.id)
      }

      if (patch.geometry && (beforeIsCanvas || afterIsCanvas)) {
        state.edge.geometry = true
        addNodeId(state.edge.nodeIds, operation.id)
      }
      return
    }
    case 'node.order.set': {
      state.node.list = true
      state.mindmap.view = true
      return
    }
    case 'edge.create': {
      state.edge.geometry = true
      state.edge.list = true
      addEdgeId(state.edge.ids, operation.edge.id)
      return
    }
    case 'edge.delete': {
      state.edge.geometry = true
      state.edge.list = true
      addEdgeId(state.edge.ids, operation.id)
      return
    }
    case 'edge.update': {
      const patch = classifyEdgePatch(operation.patch)
      state.edge.geometry ||= patch.geometry
      state.edge.value ||= patch.value
      if (patch.geometry || patch.value) {
        addEdgeId(state.edge.ids, operation.id)
      }
      return
    }
    case 'edge.order.set': {
      state.edge.list = true
      return
    }
    case 'mindmap.set': {
      markMindmapView(state.mindmap, operation.id)
      return
    }
    case 'mindmap.delete': {
      markMindmapView(state.mindmap, operation.id)
      return
    }
    default: {
      state.full = true
    }
  }
}

const finalizeReadImpact = (
  state: ReadImpactState
): KernelReadImpact => {
  if (
    state.full ||
    state.node.ids.size > DEFAULT_MAX_IDS ||
    state.edge.ids.size > DEFAULT_MAX_IDS ||
    state.edge.nodeIds.size > DEFAULT_MAX_IDS ||
    state.mindmap.ids.size > DEFAULT_MAX_IDS
  ) {
    return {
      reset: true,
      document: false,
      node: {
        ids: EMPTY_NODE_IDS,
        geometry: false,
        list: false,
        value: false
      },
      edge: {
        ids: EMPTY_EDGE_IDS,
        nodeIds: EMPTY_NODE_IDS,
        geometry: false,
        list: false,
        value: false
      },
      mindmap: {
        ids: EMPTY_NODE_IDS,
        view: false
      }
    }
  }

  return {
    reset: false,
    document: state.document,
    node: {
      ids: Array.from(state.node.ids),
      geometry: state.node.geometry,
      list: state.node.list,
      value: state.node.value
    },
    edge: {
      ids: Array.from(state.edge.ids),
      nodeIds: Array.from(state.edge.nodeIds),
      geometry: state.edge.geometry,
      list: state.edge.list,
      value: state.edge.value
    },
    mindmap: {
      ids: Array.from(state.mindmap.ids),
      view: state.mindmap.view
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
    case 'document.update': {
      if (!operation.before) {
        return {
          ...operation,
          before: {
            background: document.background
          }
        }
      }
      return operation
    }
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
    default:
      return operation
  }
}

const buildInverse = (operation: Operation): Operation[] | null => {
  switch (operation.type) {
    case 'document.update': {
      if (!operation.before) return null
      return [{
        type: 'document.update',
        patch: operation.before
      }]
    }
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
    default:
      return null
  }
}

const applyOperation = (
  draft: ReduceDraft,
  operation: Operation
) => {
  switch (operation.type) {
    case 'document.update': {
      draft.next = {
        ...draft.next,
        background: operation.patch.background
      }
      return
    }
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
      background: document.background
    },
    copied: {
      nodeEntities: false,
      edgeEntities: false,
      meta: false
    },
    read: createReadImpactState(operations.length),
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
    trackReadImpact(draft.read, operation)
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
    read: finalizeReadImpact(draft.read)
  }
}
