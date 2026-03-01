import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import { deriveCanvasNodes, deriveVisibleNodes, orderByIds } from '@whiteboard/core/node'
import type {
  Document,
  Node,
  NodeId
} from '@whiteboard/core/types'
import {
  EMPTY_NODE_MAP,
  EMPTY_NODES,
  isSameRefOrder
} from './shared'

export type NodeSlices = {
  ordered: Node[]
  visible: Node[]
  canvas: Node[]
  canvasNodeById: Map<NodeId, Node>
}

export const nodeSlices = (documentAtom: PrimitiveAtom<Document>): Atom<NodeSlices> => {
  let previousNodesRef: Document['nodes'] | undefined
  let previousOrderRef: Document['order'] extends { nodes?: infer TOrder }
    ? TOrder
    : NodeId[] | undefined
  let orderedCache: Node[] = EMPTY_NODES
  let visibleSourceRef: Node[] | undefined
  let visibleCache: Node[] = EMPTY_NODES
  let canvasSourceRef: Node[] | undefined
  let canvasCache: Node[] = EMPTY_NODES
  let canvasNodeMapSourceRef: Node[] | undefined
  let canvasNodeByIdCache: Map<NodeId, Node> = EMPTY_NODE_MAP
  let nodeSlicesCache: NodeSlices = {
    ordered: EMPTY_NODES,
    visible: EMPTY_NODES,
    canvas: EMPTY_NODES,
    canvasNodeById: EMPTY_NODE_MAP
  }

  return atom((get) => {
    const doc = get(documentAtom)
    const nodes = doc.nodes
    if (!nodes.length) {
      previousNodesRef = nodes
      previousOrderRef = doc.order?.nodes
      orderedCache = EMPTY_NODES
      visibleSourceRef = EMPTY_NODES
      visibleCache = EMPTY_NODES
      canvasSourceRef = EMPTY_NODES
      canvasCache = EMPTY_NODES
      canvasNodeMapSourceRef = EMPTY_NODES
      canvasNodeByIdCache = EMPTY_NODE_MAP
      nodeSlicesCache = {
        ordered: EMPTY_NODES,
        visible: EMPTY_NODES,
        canvas: EMPTY_NODES,
        canvasNodeById: EMPTY_NODE_MAP
      }
      return nodeSlicesCache
    }

    const orderRef = doc.order?.nodes
    if (nodes !== previousNodesRef || orderRef !== previousOrderRef) {
      const order = orderRef ?? nodes.map((node) => node.id)
      const next = orderByIds(nodes, order)
      if (!isSameRefOrder(orderedCache, next)) {
        orderedCache = next
      }
      previousNodesRef = nodes
      previousOrderRef = orderRef
    }

    if (visibleSourceRef !== orderedCache) {
      const nextVisible = deriveVisibleNodes(orderedCache)
      const normalizedVisible = nextVisible.length ? nextVisible : EMPTY_NODES
      if (!isSameRefOrder(visibleCache, normalizedVisible)) {
        visibleCache = normalizedVisible
      }
      visibleSourceRef = orderedCache
    }

    if (canvasSourceRef !== visibleCache) {
      const nextCanvas = deriveCanvasNodes(visibleCache)
      const normalizedCanvas = nextCanvas.length ? nextCanvas : EMPTY_NODES
      if (!isSameRefOrder(canvasCache, normalizedCanvas)) {
        canvasCache = normalizedCanvas
      }
      canvasSourceRef = visibleCache
    }

    if (canvasNodeMapSourceRef !== canvasCache) {
      if (!canvasCache.length) {
        canvasNodeByIdCache = EMPTY_NODE_MAP
      } else {
        const nextMap = new Map<NodeId, Node>()
        canvasCache.forEach((node) => {
          nextMap.set(node.id, node)
        })
        canvasNodeByIdCache = nextMap
      }
      canvasNodeMapSourceRef = canvasCache
    }

    if (
      nodeSlicesCache.ordered === orderedCache &&
      nodeSlicesCache.visible === visibleCache &&
      nodeSlicesCache.canvas === canvasCache &&
      nodeSlicesCache.canvasNodeById === canvasNodeByIdCache
    ) {
      return nodeSlicesCache
    }

    nodeSlicesCache = {
      ordered: orderedCache,
      visible: visibleCache,
      canvas: canvasCache,
      canvasNodeById: canvasNodeByIdCache
    }
    return nodeSlicesCache
  })
}

export const orderedNodes = (nodeSlicesAtom: Atom<NodeSlices>): Atom<Node[]> =>
  atom((get) => get(nodeSlicesAtom).ordered)

export const visibleNodes = (nodeSlicesAtom: Atom<NodeSlices>): Atom<Node[]> =>
  atom((get) => get(nodeSlicesAtom).visible)

export const canvasNodes = (nodeSlicesAtom: Atom<NodeSlices>): Atom<Node[]> => {
  let sourceRef: Node[] | undefined
  let cache: Node[] = EMPTY_NODES
  return atom((get) => {
    const nextCanvas = get(nodeSlicesAtom).canvas
    if (sourceRef !== nextCanvas) {
      sourceRef = nextCanvas
      cache = nextCanvas
    }
    return cache
  })
}
