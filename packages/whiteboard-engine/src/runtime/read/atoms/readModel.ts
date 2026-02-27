import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import { deriveCanvasNodes, deriveVisibleNodes } from '@whiteboard/core/node'
import type {
  Document,
  Edge,
  EdgeId,
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'

const EMPTY_NODES: Node[] = []
const EMPTY_EDGES: Edge[] = []
const EMPTY_NODE_IDS: NodeId[] = []
const EMPTY_NODE_MAP = new Map<NodeId, Node>()
const EMPTY_INDEX_BY_ID = new Map<NodeId, number>()

const isSameRefOrder = <T,>(left: readonly T[], right: readonly T[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const isSameNodeIdOrder = (left: readonly Node[], right: readonly Node[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.id !== right[index]?.id) return false
  }
  return true
}

const isSameIdOrder = (left: readonly NodeId[], right: readonly NodeId[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const orderByIds = <T extends { id: string }>(items: T[], ids: readonly string[]) => {
  if (!ids.length) return items

  if (items.length === ids.length) {
    let sameOrder = true
    for (let index = 0; index < items.length; index += 1) {
      if (items[index]?.id !== ids[index]) {
        sameOrder = false
        break
      }
    }
    if (sameOrder) return items
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  const idSet = new Set(ids)
  const ordered: T[] = []

  ids.forEach((id) => {
    const item = byId.get(id)
    if (item) {
      ordered.push(item)
    }
  })

  if (ordered.length === items.length) return ordered

  items.forEach((item) => {
    if (!idSet.has(item.id)) {
      ordered.push(item)
    }
  })

  return ordered
}

const buildIndexById = (nodes: readonly Node[]) => {
  const byId = new Map<NodeId, number>()
  nodes.forEach((node, index) => {
    byId.set(node.id, index)
  })
  return byId
}

const deriveMindmapRoots = (visibleNodes: readonly Node[]): NodeId[] => {
  if (!visibleNodes.length) return EMPTY_NODE_IDS
  const roots = visibleNodes
    .filter((node) => node.type === 'mindmap')
    .map((node) => node.id)
  return roots.length ? roots : EMPTY_NODE_IDS
}

const createOrderedNodesAtom = (
  documentAtom: PrimitiveAtom<Document>
): Atom<Node[]> => {
  let previousNodesRef: Document['nodes'] | undefined
  let previousOrderRef: Document['order'] extends { nodes?: infer TOrder }
    ? TOrder
    : NodeId[] | undefined
  let orderedCache: Node[] = EMPTY_NODES

  return atom((get) => {
    const doc = get(documentAtom)
    const nodes = doc.nodes
    if (!nodes.length) {
      previousNodesRef = nodes
      previousOrderRef = doc.order?.nodes
      orderedCache = EMPTY_NODES
      return orderedCache
    }

    const orderRef = doc.order?.nodes
    if (nodes === previousNodesRef && orderRef === previousOrderRef) {
      return orderedCache
    }

    const order = orderRef ?? nodes.map((node) => node.id)
    const next = orderByIds(nodes, order)
    if (!isSameRefOrder(orderedCache, next)) {
      orderedCache = next
    }

    previousNodesRef = nodes
    previousOrderRef = orderRef
    return orderedCache
  })
}

const createVisibleNodesAtom = (orderedNodesAtom: Atom<Node[]>): Atom<Node[]> => {
  let orderedNodesRef: Node[] | undefined
  let visibleCache: Node[] = EMPTY_NODES

  return atom((get) => {
    const orderedNodes = get(orderedNodesAtom)
    if (orderedNodes === orderedNodesRef) {
      return visibleCache
    }

    const next = deriveVisibleNodes(orderedNodes)
    const normalized = next.length ? next : EMPTY_NODES
    if (!isSameRefOrder(visibleCache, normalized)) {
      visibleCache = normalized
    }

    orderedNodesRef = orderedNodes
    return visibleCache
  })
}

const createCanvasNodesAtom = (visibleNodesAtom: Atom<Node[]>): Atom<Node[]> => {
  let visibleNodesRef: Node[] | undefined
  let canvasCache: Node[] = EMPTY_NODES

  return atom((get) => {
    const visibleNodes = get(visibleNodesAtom)
    if (visibleNodes === visibleNodesRef) {
      return canvasCache
    }

    const next = deriveCanvasNodes(visibleNodes)
    const normalized = next.length ? next : EMPTY_NODES
    if (!isSameRefOrder(canvasCache, normalized)) {
      canvasCache = normalized
    }

    visibleNodesRef = visibleNodes
    return canvasCache
  })
}

const createVisibleEdgesAtom = (
  documentAtom: PrimitiveAtom<Document>,
  canvasNodesAtom: Atom<Node[]>
): Atom<Edge[]> => {
  type Cache = {
    edgesRef: Document['edges']
    edgeOrderRef: Document['order'] extends { edges?: infer TOrder }
      ? TOrder
      : EdgeId[] | undefined
    canvasNodes: Node[]
    visibleEdges: Edge[]
  }

  let cache: Cache | undefined

  return atom((get) => {
    const doc = get(documentAtom)
    const canvasNodes = get(canvasNodesAtom)

    if (!doc.edges.length || !canvasNodes.length) {
      cache = {
        edgesRef: doc.edges,
        edgeOrderRef: doc.order?.edges,
        canvasNodes,
        visibleEdges: EMPTY_EDGES
      }
      return EMPTY_EDGES
    }

    const edgeOrderRef = doc.order?.edges
    if (
      cache
      && cache.edgesRef === doc.edges
      && cache.edgeOrderRef === edgeOrderRef
      && isSameNodeIdOrder(cache.canvasNodes, canvasNodes)
    ) {
      return cache.visibleEdges
    }

    const edgeOrder = edgeOrderRef ?? doc.edges.map((edge) => edge.id)
    const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
    const edges = doc.edges.filter(
      (edge) =>
        canvasNodeIds.has(edge.source.nodeId)
        && canvasNodeIds.has(edge.target.nodeId)
    )
    const ordered = orderByIds(edges, edgeOrder)
    const visibleEdges = ordered.length ? ordered : EMPTY_EDGES

    cache = {
      edgesRef: doc.edges,
      edgeOrderRef,
      canvasNodes,
      visibleEdges
    }

    return visibleEdges
  })
}

const createMindmapRootsAtom = (visibleNodesAtom: Atom<Node[]>): Atom<NodeId[]> => {
  let visibleNodesRef: Node[] | undefined
  let rootsCache: NodeId[] = EMPTY_NODE_IDS

  return atom((get) => {
    const visibleNodes = get(visibleNodesAtom)
    if (visibleNodes === visibleNodesRef) {
      return rootsCache
    }

    const nextRoots = deriveMindmapRoots(visibleNodes)
    if (!isSameIdOrder(rootsCache, nextRoots)) {
      rootsCache = nextRoots
    }

    visibleNodesRef = visibleNodes
    return rootsCache
  })
}

const createIndexesAtom = (
  visibleNodesAtom: Atom<Node[]>,
  canvasNodesAtom: Atom<Node[]>
): Atom<ReadModelSnapshot['indexes']> => {
  let visibleNodesRef: Node[] | undefined
  let canvasNodesRef: Node[] | undefined

  let canvasNodeById = EMPTY_NODE_MAP
  let visibleNodeIndexById = EMPTY_INDEX_BY_ID
  let canvasNodeIndexById = EMPTY_INDEX_BY_ID

  return atom((get) => {
    const visibleNodes = get(visibleNodesAtom)
    const canvasNodes = get(canvasNodesAtom)

    if (canvasNodes !== canvasNodesRef) {
      canvasNodeById = canvasNodes.length
        ? new Map(canvasNodes.map((node) => [node.id, node]))
        : EMPTY_NODE_MAP
      canvasNodeIndexById = canvasNodes.length
        ? buildIndexById(canvasNodes)
        : EMPTY_INDEX_BY_ID
      canvasNodesRef = canvasNodes
    }

    if (visibleNodes !== visibleNodesRef) {
      visibleNodeIndexById = visibleNodes.length
        ? buildIndexById(visibleNodes)
        : EMPTY_INDEX_BY_ID
      visibleNodesRef = visibleNodes
    }

    return {
      canvasNodeById,
      visibleNodeIndexById,
      canvasNodeIndexById
    }
  })
}

const createSnapshotAtom = (options: {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
  visibleNodesAtom: Atom<Node[]>
  canvasNodesAtom: Atom<Node[]>
  visibleEdgesAtom: Atom<Edge[]>
  mindmapRootsAtom: Atom<NodeId[]>
  indexesAtom: Atom<ReadModelSnapshot['indexes']>
}): Atom<ReadModelSnapshot> => {
  let cache: ReadModelSnapshot | undefined

  return atom((get) => {
    const doc = get(options.documentAtom)
    const revision = get(options.revisionAtom)
    const visibleNodes = get(options.visibleNodesAtom)
    const canvasNodes = get(options.canvasNodesAtom)
    const visibleEdges = get(options.visibleEdgesAtom)
    const mindmapRoots = get(options.mindmapRootsAtom)
    const indexes = get(options.indexesAtom)

    if (
      cache
      && cache.revision === revision
      && cache.docId === doc.id
      && cache.nodes.visible === visibleNodes
      && cache.nodes.canvas === canvasNodes
      && cache.edges.visible === visibleEdges
      && cache.mindmap.roots === mindmapRoots
      && cache.indexes.canvasNodeById === indexes.canvasNodeById
      && cache.indexes.visibleNodeIndexById === indexes.visibleNodeIndexById
      && cache.indexes.canvasNodeIndexById === indexes.canvasNodeIndexById
    ) {
      return cache
    }

    cache = {
      revision,
      docId: doc.id,
      nodes: {
        visible: visibleNodes,
        canvas: canvasNodes
      },
      edges: {
        visible: visibleEdges
      },
      mindmap: {
        roots: mindmapRoots
      },
      indexes
    }
    return cache
  })
}

export type ReadModelAtoms = {
  document: PrimitiveAtom<Document>
  revision: PrimitiveAtom<number>
  orderedNodes: Atom<Node[]>
  visibleNodes: Atom<Node[]>
  canvasNodes: Atom<Node[]>
  visibleEdges: Atom<Edge[]>
  mindmapRoots: Atom<NodeId[]>
  indexes: Atom<ReadModelSnapshot['indexes']>
  snapshot: Atom<ReadModelSnapshot>
}

type CreateReadModelAtomsOptions = {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
}

export const createReadModelAtoms = ({
  documentAtom,
  revisionAtom
}: CreateReadModelAtomsOptions): ReadModelAtoms => {
  const orderedNodesAtom = createOrderedNodesAtom(documentAtom)
  const visibleNodesAtom = createVisibleNodesAtom(orderedNodesAtom)
  const canvasNodesAtom = createCanvasNodesAtom(visibleNodesAtom)
  const visibleEdgesAtom = createVisibleEdgesAtom(documentAtom, canvasNodesAtom)
  const mindmapRootsAtom = createMindmapRootsAtom(visibleNodesAtom)
  const indexesAtom = createIndexesAtom(visibleNodesAtom, canvasNodesAtom)

  return {
    document: documentAtom,
    revision: revisionAtom,
    orderedNodes: orderedNodesAtom,
    visibleNodes: visibleNodesAtom,
    canvasNodes: canvasNodesAtom,
    visibleEdges: visibleEdgesAtom,
    mindmapRoots: mindmapRootsAtom,
    indexes: indexesAtom,
    snapshot: createSnapshotAtom({
      documentAtom,
      revisionAtom,
      visibleNodesAtom,
      canvasNodesAtom,
      visibleEdgesAtom,
      mindmapRootsAtom,
      indexesAtom
    })
  }
}
