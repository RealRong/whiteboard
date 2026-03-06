import type {
  Document,
  DocumentId,
  Edge,
  EdgeId,
  Node,
  NodeId
} from '../../types/core'
import type { MindmapId, MindmapNodeId, MindmapTree } from '../../mindmap/types'
import { getMindmapTreeFromNode } from '../../mindmap/helpers'
import { createId } from '../../utils/id'

export type KernelMaps = {
  nodes: Map<NodeId, Node>
  edges: Map<EdgeId, Edge>
  mindmaps: Map<MindmapId, MindmapTree>
}

export type KernelState = {
  document: Document
  maps: KernelMaps
  now: () => number
  createChangeSetId: () => string
  getDocument: () => Document
  applyDocument: (recipe: (draft: Document) => void) => void
  loadDocument: (document: Document) => void
  cloneNode: (node: Node) => Node
  cloneEdge: (edge: Edge) => Edge
  cloneMindmapTree: (tree: MindmapTree) => MindmapTree
  clonePoint: (point: { x: number; y: number }) => { x: number; y: number }
  touchDocument: (document: Document, timestamp: number) => void
  rebuildMaps: () => void
}

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

const normalizeDocument = (document: Document): Document => ({
  ...document,
  nodes: document.nodes ?? [],
  edges: document.edges ?? [],
  mindmaps: document.mindmaps ?? [],
  order:
    document.order ??
    ({
      nodes: (document.nodes ?? []).map((node) => node.id),
      edges: (document.edges ?? []).map((edge) => edge.id)
    } as Document['order'])
})

export const createKernelState = ({
  document,
  now
}: {
  document?: Document
  now?: () => number
} = {}): KernelState => {
  const readNow = now ?? (() => Date.now())
  const createDocumentId = () => createId('doc')
  const createChangeSetId = () => createId('change')

  const stateDocument = normalizeDocument(
    document ?? createDefaultDocument(createDocumentId())
  )

  const maps: KernelMaps = {
    nodes: new Map<NodeId, Node>(),
    edges: new Map<EdgeId, Edge>(),
    mindmaps: new Map<MindmapId, MindmapTree>()
  }

  const getDocument = () => stateDocument
  const applyDocument = (recipe: (draft: Document) => void) => recipe(stateDocument)

  const clonePoint = (point: { x: number; y: number }) => ({ x: point.x, y: point.y })

  const cloneMindmapTree = (tree: MindmapTree): MindmapTree => ({
    ...tree,
    nodes: Object.fromEntries(
      Object.entries(tree.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          data: node.data && typeof node.data === 'object'
            ? { ...(node.data as Record<string, unknown>) }
            : node.data,
          style: node.style ? { ...node.style } : undefined
        }
      ])
    ),
    children: Object.fromEntries(
      Object.entries(tree.children).map(([id, list]) => [id, [...list]])
    ),
    meta: tree.meta
      ? {
          ...tree.meta,
          position: tree.meta.position
            ? { x: tree.meta.position.x, y: tree.meta.position.y }
            : undefined
        }
      : undefined
  })

  const cloneNode = (node: Node): Node => {
    const mindmapTree = getMindmapTreeFromNode(node)
    const data = node.data ? { ...node.data } : undefined
    if (mindmapTree && data && typeof data === 'object') {
      return {
        ...node,
        position: clonePoint(node.position),
        size: node.size
          ? { width: node.size.width, height: node.size.height }
          : undefined,
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
      size: node.size
        ? { width: node.size.width, height: node.size.height }
        : undefined,
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
    style: edge.style
      ? { ...edge.style, dash: edge.style.dash ? [...edge.style.dash] : undefined }
      : undefined,
    label: edge.label
      ? { ...edge.label, offset: edge.label.offset ? clonePoint(edge.label.offset) : undefined }
      : undefined,
    data: edge.data && typeof edge.data === 'object'
      ? { ...(edge.data as Record<string, unknown>) }
      : edge.data
  })

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

  const loadDocument = (nextDocument: Document) => {
    const normalized = normalizeDocument(nextDocument)
    stateDocument.id = normalized.id
    stateDocument.name = normalized.name
    stateDocument.nodes = normalized.nodes
    stateDocument.edges = normalized.edges
    stateDocument.mindmaps = normalized.mindmaps
    stateDocument.order = normalized.order
    stateDocument.background = normalized.background
    stateDocument.viewport = normalized.viewport
    stateDocument.meta = normalized.meta
    rebuildMaps()
  }

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
    document: stateDocument,
    maps,
    now: readNow,
    createChangeSetId,
    getDocument,
    applyDocument,
    loadDocument,
    cloneNode,
    cloneEdge,
    cloneMindmapTree,
    clonePoint,
    touchDocument,
    rebuildMaps
  }
}
