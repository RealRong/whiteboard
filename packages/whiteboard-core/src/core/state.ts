import type { Document, DocumentId, Edge, EdgeId, Node, NodeId, Snapshot } from '../types/core'
import type { MindmapId, MindmapNodeId, MindmapTree } from '../mindmap/types'
import { getMindmapTreeFromNode } from '../mindmap/helpers'

export interface CreateCoreOptions {
  snapshot?: Snapshot
  document?: Document
  schemaVersion?: string
  now?: () => number
  getState?: () => Document
  apply?: (recipe: (draft: Document) => void) => void
  idGenerator?: {
    documentId?: () => DocumentId
    nodeId?: () => NodeId
    edgeId?: () => EdgeId
    mindmapId?: () => MindmapId
    mindmapNodeId?: () => MindmapNodeId
    changeSetId?: () => string
  }
}

export type Maps = {
  nodes: Map<NodeId, Node>
  edges: Map<EdgeId, Edge>
  mindmaps: Map<MindmapId, MindmapTree>
}

export type CoreState = {
  document: Document
  getDocument: () => Document
  applyDocument: (recipe: (draft: Document) => void) => void
  maps: Maps
  schemaVersion: string
  now: () => number
  createDocumentId: () => DocumentId
  createNodeId: () => NodeId
  createEdgeId: () => EdgeId
  createMindmapId: () => MindmapId
  createMindmapNodeId: () => MindmapNodeId
  createChangeSetId: () => string
  cloneNode: (node: Node) => Node
  cloneEdge: (edge: Edge) => Edge
  cloneMindmapTree: (tree: MindmapTree) => MindmapTree
  clonePoint: (point: { x: number; y: number }) => { x: number; y: number }
  touchDocument: (document: Document, timestamp: number) => void
  rebuildMaps: () => void
}

const DEFAULT_SCHEMA_VERSION = '0.1.0'

const createDefaultDocument = (id: DocumentId): Document => ({
  id,
  nodes: [],
  edges: [],
  mindmaps: [],
  order: {
    nodes: [],
    edges: []
  }
})

export const createCoreState = (options: CreateCoreOptions = {}): CoreState => {
  let nodeSeq = 1
  let edgeSeq = 1
  let changeSeq = 1
  let mindmapSeq = 1
  let mindmapNodeSeq = 1

  const now = options.now ?? (() => Date.now())
  const createDocumentId = options.idGenerator?.documentId ?? (() => `doc_${now()}`)
  const createNodeId = options.idGenerator?.nodeId ?? (() => `node_${nodeSeq++}`)
  const createEdgeId = options.idGenerator?.edgeId ?? (() => `edge_${edgeSeq++}`)
  const createMindmapId = options.idGenerator?.mindmapId ?? (() => `mindmap_${mindmapSeq++}`)
  const createMindmapNodeId = options.idGenerator?.mindmapNodeId ?? (() => `mnode_${mindmapNodeSeq++}`)
  const createChangeSetId = options.idGenerator?.changeSetId ?? (() => `change_${changeSeq++}`)

  const schemaVersion = options.snapshot?.schemaVersion ?? options.schemaVersion ?? DEFAULT_SCHEMA_VERSION

  const initialDocument =
    options.snapshot?.document ??
    options.document ??
    createDefaultDocument(createDocumentId())

  const document: Document = {
    ...initialDocument,
    nodes: initialDocument.nodes ?? [],
    edges: initialDocument.edges ?? [],
    mindmaps: initialDocument.mindmaps ?? [],
    order:
      initialDocument.order ??
      ({
        nodes: (initialDocument.nodes ?? []).map((node) => node.id),
        edges: (initialDocument.edges ?? []).map((edge) => edge.id)
      } as Document['order'])
  }

  const maps: Maps = {
    nodes: new Map<NodeId, Node>(),
    edges: new Map<EdgeId, Edge>(),
    mindmaps: new Map<MindmapId, MindmapTree>()
  }

  const getDocument = options.getState ?? (() => document)
  const applyDocument = options.apply ?? ((recipe: (draft: Document) => void) => recipe(document))

  const rebuildMaps = () => {
    maps.nodes.clear()
    maps.edges.clear()
    maps.mindmaps.clear()
    const current = getDocument()
    current.nodes.forEach((node) => {
      maps.nodes.set(node.id, node)
      const tree = getMindmapTreeFromNode(node)
      if (tree) {
        const normalized = tree.id === node.id ? tree : { ...tree, id: node.id }
        maps.mindmaps.set(node.id, normalized)
      }
    })
    current.edges.forEach((edge) => maps.edges.set(edge.id, edge))
  }

  const clonePoint = (point: { x: number; y: number }) => ({ x: point.x, y: point.y })

  const cloneNode = (node: Node): Node => {
    const mindmapTree = getMindmapTreeFromNode(node)
    const data = node.data ? { ...node.data } : undefined
    if (mindmapTree && data && typeof data === 'object') {
      return {
        ...node,
        position: clonePoint(node.position),
        size: node.size ? { width: node.size.width, height: node.size.height } : undefined,
        data: {
          ...(data as Record<string, unknown>),
          mindmap: cloneMindmapTree(mindmapTree)
        },
        style: node.style ? { ...node.style } : undefined
      }
    }
    return {
      ...node,
      position: clonePoint(node.position),
      size: node.size ? { width: node.size.width, height: node.size.height } : undefined,
      data,
      style: node.style ? { ...node.style } : undefined
    }
  }

  const cloneEdge = (edge: Edge): Edge => ({
    ...edge,
    source: {
      nodeId: edge.source.nodeId,
      anchor: edge.source.anchor ? { ...edge.source.anchor } : undefined
    },
    target: {
      nodeId: edge.target.nodeId,
      anchor: edge.target.anchor ? { ...edge.target.anchor } : undefined
    },
    routing: edge.routing
      ? {
          ...edge.routing,
          points: edge.routing.points ? edge.routing.points.map(clonePoint) : undefined,
          locked: edge.routing.locked ? [...edge.routing.locked] : undefined,
          avoid: edge.routing.avoid ? { ...edge.routing.avoid } : undefined,
          ortho: edge.routing.ortho ? { ...edge.routing.ortho } : undefined
        }
      : undefined,
    style: edge.style ? { ...edge.style, dash: edge.style.dash ? [...edge.style.dash] : undefined } : undefined,
    label: edge.label ? { ...edge.label, offset: edge.label.offset ? clonePoint(edge.label.offset) : undefined } : undefined,
    data: edge.data && typeof edge.data === 'object' ? { ...(edge.data as Record<string, unknown>) } : edge.data
  })

  const cloneMindmapTree = (tree: MindmapTree): MindmapTree => ({
    ...tree,
    nodes: Object.fromEntries(
      Object.entries(tree.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          data: node.data && typeof node.data === 'object' ? { ...(node.data as Record<string, unknown>) } : node.data,
          style: node.style ? { ...node.style } : undefined
        }
      ])
    ),
    children: Object.fromEntries(Object.entries(tree.children).map(([id, list]) => [id, [...list]])),
    meta: tree.meta
      ? {
          ...tree.meta,
          position: tree.meta.position ? { x: tree.meta.position.x, y: tree.meta.position.y } : undefined
        }
      : undefined
  })

  const touchDocument = (target: Document, timestamp: number) => {
    const iso = new Date(timestamp).toISOString()
    if (!target.meta) {
      target.meta = { createdAt: iso, updatedAt: iso }
      return
    }
    if (!target.meta.createdAt) {
      target.meta.createdAt = iso
    }
    target.meta.updatedAt = iso
  }

  rebuildMaps()

  return {
    document,
    getDocument,
    applyDocument,
    maps,
    schemaVersion,
    now,
    createDocumentId,
    createNodeId,
    createEdgeId,
    createMindmapId,
    createMindmapNodeId,
    createChangeSetId,
    cloneNode,
    cloneEdge,
    cloneMindmapTree,
    clonePoint,
    touchDocument,
    rebuildMaps
  }
}
