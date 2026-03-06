import type {
  ChangeSet,
  DispatchFailure,
  DispatchResult,
  Document,
  DocumentId,
  Edge,
  EdgeId,
  EdgePatch,
  Node,
  NodeId,
  NodePatch,
  Operation,
  Origin
} from '../types/core'
import type { MindmapId, MindmapTree } from '../mindmap/types'
import { getMindmapTreeFromNode } from '../mindmap/helpers'
import { createId } from '../utils/id'

export type KernelMaps = {
  nodes: Map<NodeId, Node>
  edges: Map<EdgeId, Edge>
  mindmaps: Map<MindmapId, MindmapTree>
}

export type KernelRebuild = 'none' | 'dirty' | 'full'

export type KernelProjectionInvalidation = {
  index: {
    rebuild: KernelRebuild
    nodeIds: readonly NodeId[]
  }
  edge: {
    rebuild: KernelRebuild
    nodeIds: readonly NodeId[]
    edgeIds: readonly EdgeId[]
  }
}

type KernelApplyResult =
  | {
      ok: true
      changes: ChangeSet
      inverse: readonly Operation[]
      invalidation: KernelProjectionInvalidation
    }
  | DispatchFailure

export type KernelSession = {
  document: Document
  maps: KernelMaps
  applyOperations: (
    operations: readonly Operation[],
    origin?: Origin
  ) => KernelApplyResult
  exportDocument: () => Document
  cloneNode: (node: Node) => Node
  cloneEdge: (edge: Edge) => Edge
  cloneMindmapTree: (tree: MindmapTree) => MindmapTree
  clonePoint: (point: { x: number; y: number }) => { x: number; y: number }
}

type InvalidationState = {
  full: boolean
  hasEdges: boolean
  hasOrder: boolean
  hasGeometry: boolean
  hasMindmap: boolean
  nodeIds: Set<NodeId>
  edgeIds: Set<EdgeId>
}

const DEFAULT_MAX_OPERATIONS = 100
const DEFAULT_MAX_NODE_IDS = 200
const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

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

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export const cloneDocument = (document: Document): Document => cloneValue(document)

const createDefaultDocument = (id: DocumentId): Document => ({
  id,
  nodes: [],
  edges: [],
  order: {
    nodes: [],
    edges: []
  }
})

const normalizeDocument = (document: Document): Document => {
  const nodes = cloneValue(document.nodes ?? [])
  const edgeList = cloneValue(document.edges ?? [])
  const nodeOrder = document.order?.nodes ? [...document.order.nodes] : nodes.map((node) => node.id)
  const edgeOrder = document.order?.edges ? [...document.order.edges] : edgeList.map((edge) => edge.id)

  return {
    ...document,
    nodes,
    edges: edgeList,
    order: {
      nodes: nodeOrder,
      edges: edgeOrder
    }
  }
}

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

export const createKernelSession = ({
  document,
  now
}: {
  document?: Document
  now?: () => number
} = {}): KernelSession => {
  const readNow = now ?? (() => Date.now())
  const stateDocument = normalizeDocument(
    document ?? createDefaultDocument(createId('doc'))
  )

  const maps: KernelMaps = {
    nodes: new Map<NodeId, Node>(),
    edges: new Map<EdgeId, Edge>(),
    mindmaps: new Map<MindmapId, MindmapTree>()
  }

  const mutate = (recipe: (draft: Document) => void) => recipe(stateDocument)

  const clonePoint = <T extends { x: number; y: number }>(point: T): T => cloneValue(point)
  const cloneNode = (node: Node): Node => cloneValue(node)
  const cloneEdge = (edge: Edge): Edge => cloneValue(edge)
  const cloneMindmapTree = (tree: MindmapTree): MindmapTree => cloneValue(tree)

  const rebuildMaps = () => {
    maps.nodes.clear()
    maps.edges.clear()
    maps.mindmaps.clear()

    stateDocument.nodes.forEach((node) => {
      maps.nodes.set(node.id, node)
      const tree = getMindmapTreeFromNode(node)
      if (tree) {
        maps.mindmaps.set(node.id, tree.id === node.id ? cloneValue(tree) : cloneValue({ ...tree, id: node.id }))
      }
    })

    stateDocument.edges.forEach((edge) => maps.edges.set(edge.id, edge))
  }

  const touch = (timestamp: number) => {
    const iso = new Date(timestamp).toISOString()
    if (!stateDocument.meta) {
      stateDocument.meta = { createdAt: iso, updatedAt: iso }
      return
    }
    if (!stateDocument.meta.createdAt) {
      stateDocument.meta.createdAt = iso
    }
    stateDocument.meta.updatedAt = iso
  }

  const exportDocument = (): Document => ({
    ...stateDocument,
    nodes: stateDocument.nodes.map(cloneNode),
    edges: stateDocument.edges.map(cloneEdge),
    order: {
      nodes: [...stateDocument.order.nodes],
      edges: [...stateDocument.order.edges]
    },
    background: stateDocument.background ? cloneValue(stateDocument.background) : undefined,
    viewport: stateDocument.viewport ? cloneValue(stateDocument.viewport) : undefined,
    meta: stateDocument.meta ? cloneValue(stateDocument.meta) : undefined
  })

  const createChangeSet = (
    operations: ChangeSet['operations'],
    origin?: Origin
  ): ChangeSet => ({
    id: createId('change'),
    timestamp: readNow(),
    operations,
    origin
  })

  const getMindmapNode = (documentDraft: Document, id: string) =>
    documentDraft.nodes.find((node) => node.id === id && node.type === 'mindmap')

  const readMindmapTree = (documentDraft: Document, id: string) => {
    const node = getMindmapNode(documentDraft, id)
    const tree = getMindmapTreeFromNode(node)
    return tree ? (tree.id === id ? tree : { ...tree, id }) : undefined
  }

  const writeMindmapTree = (
    node: Document['nodes'][number],
    tree: MindmapTree
  ) => {
    const normalized = tree.id === node.id ? cloneMindmapTree(tree) : cloneMindmapTree({ ...tree, id: node.id })
    node.data = {
      ...(node.data && typeof node.data === 'object'
        ? (node.data as Record<string, unknown>)
        : {}),
      mindmap: normalized
    }
    maps.mindmaps.set(node.id, normalized)
    maps.nodes.set(node.id, node)
  }

  const appendOrderId = <T extends string>(order: T[], id: T) => {
    if (!order.includes(id)) {
      order.push(id)
    }
  }

  const removeOrderId = <T extends string>(order: T[], id: T) => {
    const index = order.indexOf(id)
    if (index >= 0) {
      order.splice(index, 1)
    }
  }

  const normalizeOperation = (operation: Operation): Operation => {
    switch (operation.type) {
      case 'node.update': {
        const current = maps.nodes.get(operation.id)
        if (!operation.before && current) {
          return {
            ...operation,
            before: cloneNode(current)
          }
        }
        return operation
      }
      case 'node.delete': {
        const current = maps.nodes.get(operation.id)
        if (!operation.before && current) {
          return {
            ...operation,
            before: cloneNode(current)
          }
        }
        return operation
      }
      case 'node.order.set': {
        if (!operation.before) {
          return {
            ...operation,
            before: [...stateDocument.order.nodes]
          }
        }
        return operation
      }
      case 'edge.update': {
        const current = maps.edges.get(operation.id)
        if (!operation.before && current) {
          return {
            ...operation,
            before: cloneEdge(current)
          }
        }
        return operation
      }
      case 'edge.delete': {
        const current = maps.edges.get(operation.id)
        if (!operation.before && current) {
          return {
            ...operation,
            before: cloneEdge(current)
          }
        }
        return operation
      }
      case 'edge.order.set': {
        if (!operation.before) {
          return {
            ...operation,
            before: [...stateDocument.order.edges]
          }
        }
        return operation
      }
      case 'mindmap.set': {
        const current = readMindmapTree(stateDocument, operation.id)
        if (!operation.before && current) {
          return {
            ...operation,
            before: cloneMindmapTree(current)
          }
        }
        return operation
      }
      case 'mindmap.delete': {
        const current = readMindmapTree(stateDocument, operation.id)
        if (!operation.before && current) {
          return {
            ...operation,
            before: cloneMindmapTree(current)
          }
        }
        return operation
      }
      case 'viewport.update': {
        if (!operation.before && stateDocument.viewport) {
          return {
            ...operation,
            before: cloneValue(stateDocument.viewport)
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
          id: operation.node.id,
          before: cloneNode(operation.node)
        }]
      }
      case 'node.update': {
        if (!operation.before) return null
        return [{
          type: 'node.update',
          id: operation.id,
          patch: cloneNode(operation.before) as unknown as NodePatch
        }]
      }
      case 'node.delete': {
        if (!operation.before) return null
        return [{
          type: 'node.create',
          node: cloneNode(operation.before)
        }]
      }
      case 'node.order.set': {
        if (!operation.before) return null
        return [{
          type: 'node.order.set',
          ids: [...operation.before]
        }]
      }
      case 'edge.create': {
        return [{
          type: 'edge.delete',
          id: operation.edge.id,
          before: cloneEdge(operation.edge)
        }]
      }
      case 'edge.update': {
        if (!operation.before) return null
        return [{
          type: 'edge.update',
          id: operation.id,
          patch: cloneEdge(operation.before) as unknown as EdgePatch
        }]
      }
      case 'edge.delete': {
        if (!operation.before) return null
        return [{
          type: 'edge.create',
          edge: cloneEdge(operation.before)
        }]
      }
      case 'edge.order.set': {
        if (!operation.before) return null
        return [{
          type: 'edge.order.set',
          ids: [...operation.before]
        }]
      }
      case 'mindmap.set': {
        if (!operation.before) {
          return [{
            type: 'mindmap.delete',
            id: operation.id,
            before: cloneMindmapTree(operation.tree)
          }]
        }
        return [{
          type: 'mindmap.set',
          id: operation.id,
          before: cloneMindmapTree(operation.tree),
          tree: cloneMindmapTree(operation.before)
        }]
      }
      case 'mindmap.delete': {
        if (!operation.before) return null
        return [{
          type: 'mindmap.set',
          id: operation.id,
          tree: cloneMindmapTree(operation.before)
        }]
      }
      case 'viewport.update': {
        if (!operation.before) return null
        return [{
          type: 'viewport.update',
          before: cloneValue(operation.after),
          after: cloneValue(operation.before)
        }]
      }
      default:
        return null
    }
  }

  const applyOperation = (
    operation: Operation,
    documentDraft: Document
  ) => {
    switch (operation.type) {
      case 'node.create': {
        maps.nodes.set(operation.node.id, operation.node)
        documentDraft.nodes.push(operation.node)
        appendOrderId(documentDraft.order.nodes, operation.node.id)
        const tree = getMindmapTreeFromNode(operation.node)
        if (tree) {
          maps.mindmaps.set(
            operation.node.id,
            cloneMindmapTree(tree.id === operation.node.id ? tree : { ...tree, id: operation.node.id })
          )
        }
        break
      }
      case 'node.update': {
        const current = maps.nodes.get(operation.id)
        if (!current) break
        const updated = { ...current, ...operation.patch }
        maps.nodes.set(operation.id, updated)
        const index = documentDraft.nodes.findIndex((node) => node.id === operation.id)
        if (index >= 0) {
          documentDraft.nodes[index] = updated
        }
        const tree = getMindmapTreeFromNode(updated)
        if (tree) {
          maps.mindmaps.set(
            operation.id,
            cloneMindmapTree(tree.id === operation.id ? tree : { ...tree, id: operation.id })
          )
        } else {
          maps.mindmaps.delete(operation.id)
        }
        break
      }
      case 'node.delete': {
        maps.nodes.delete(operation.id)
        maps.mindmaps.delete(operation.id)
        const index = documentDraft.nodes.findIndex((node) => node.id === operation.id)
        if (index >= 0) {
          documentDraft.nodes.splice(index, 1)
        }
        removeOrderId(documentDraft.order.nodes, operation.id)
        break
      }
      case 'node.order.set': {
        documentDraft.order.nodes = [...operation.ids]
        break
      }
      case 'edge.create': {
        maps.edges.set(operation.edge.id, operation.edge)
        documentDraft.edges.push(operation.edge)
        appendOrderId(documentDraft.order.edges, operation.edge.id)
        break
      }
      case 'edge.update': {
        const current = maps.edges.get(operation.id)
        if (!current) break
        const updated = { ...current, ...operation.patch }
        maps.edges.set(operation.id, updated)
        const index = documentDraft.edges.findIndex((edge) => edge.id === operation.id)
        if (index >= 0) {
          documentDraft.edges[index] = updated
        }
        break
      }
      case 'edge.delete': {
        maps.edges.delete(operation.id)
        const index = documentDraft.edges.findIndex((edge) => edge.id === operation.id)
        if (index >= 0) {
          documentDraft.edges.splice(index, 1)
        }
        removeOrderId(documentDraft.order.edges, operation.id)
        break
      }
      case 'edge.order.set': {
        documentDraft.order.edges = [...operation.ids]
        break
      }
      case 'mindmap.set': {
        const existingIndex = documentDraft.nodes.findIndex((node) => node.id === operation.id)
        const position = operation.tree.meta?.position ?? { x: 0, y: 0 }
        if (existingIndex < 0) {
          const nextNode: Node = {
            id: operation.id,
            type: 'mindmap',
            position,
            data: { mindmap: cloneMindmapTree(operation.tree) }
          }
          documentDraft.nodes.push(nextNode)
          maps.nodes.set(nextNode.id, nextNode)
          appendOrderId(documentDraft.order.nodes, nextNode.id)
          maps.mindmaps.set(nextNode.id, cloneMindmapTree(operation.tree))
          break
        }

        const node = documentDraft.nodes[existingIndex]
        if (node.type === 'mindmap') {
          if (!node.position) {
            node.position = position
          }
          writeMindmapTree(node, operation.tree)
        }
        break
      }
      case 'mindmap.delete': {
        maps.mindmaps.delete(operation.id)
        maps.nodes.delete(operation.id)
        const index = documentDraft.nodes.findIndex((node) => node.id === operation.id)
        if (index >= 0) {
          documentDraft.nodes.splice(index, 1)
        }
        removeOrderId(documentDraft.order.nodes, operation.id)
        break
      }
      case 'viewport.update': {
        documentDraft.viewport = cloneValue(operation.after)
        break
      }
      default:
        break
    }
  }

  const applyOperations: KernelSession['applyOperations'] = (operations, origin) => {
    if (operations.length === 0) {
      return createDispatchFailure('invalid', 'No operations to apply.')
    }

    const normalizedOperations: Operation[] = []
    const inverseGroups: Operation[][] = []
    const invalidationState = createInvalidationState(operations.length)
    const changes = createChangeSet(normalizedOperations, origin)
    let failure: DispatchFailure | undefined

    mutate((documentDraft) => {
      for (const rawOperation of operations) {
        const operation = normalizeOperation(rawOperation)
        const inverseOperations = buildInverse(operation)
        if (!inverseOperations) {
          failure = createDispatchFailure('invalid', 'Operation is not invertible.')
          return
        }

        normalizedOperations.push(operation)
        inverseGroups.push(inverseOperations)
        trackInvalidation(invalidationState, operation)
        applyOperation(operation, documentDraft)
      }

      if (failure) return
      touch(changes.timestamp)
    })

    if (failure) {
      return failure
    }

    const inverse: Operation[] = []
    for (let index = inverseGroups.length - 1; index >= 0; index -= 1) {
      inverse.push(...inverseGroups[index])
    }

    return {
      ok: true,
      changes,
      inverse,
      invalidation: finalizeInvalidation(invalidationState)
    }
  }

  rebuildMaps()

  return {
    document: stateDocument,
    maps,
    applyOperations,
    exportDocument,
    cloneNode,
    cloneEdge,
    cloneMindmapTree,
    clonePoint
  }
}
