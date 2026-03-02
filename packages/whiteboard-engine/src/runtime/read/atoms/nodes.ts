import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import { deriveNodeReadSlices } from '@whiteboard/core/node'
import {
  isSameMapValueRefs,
  isSameRefOrder
} from '@whiteboard/core/utils'
import type {
  Document,
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import {
  EMPTY_NODE_MAP,
  EMPTY_NODES
} from './shared'

export type NodeSlices = {
  ordered: Node[]
  visible: Node[]
  canvas: Node[]
  canvasNodeById: Map<NodeId, Node>
  indexes: ReadModelSnapshot['indexes']
}

export const nodeSlices = (documentAtom: PrimitiveAtom<Document>): Atom<NodeSlices> => {
  let previousNodesRef: Document['nodes'] | undefined
  let previousOrderRef: Document['order'] extends { nodes?: infer TOrder }
    ? TOrder
    : NodeId[] | undefined
  let orderedCache: Node[] = EMPTY_NODES
  let visibleCache: Node[] = EMPTY_NODES
  let canvasCache: Node[] = EMPTY_NODES
  let canvasNodeByIdCache: Map<NodeId, Node> = EMPTY_NODE_MAP
  let indexesCache: ReadModelSnapshot['indexes'] = {
    canvasNodeById: EMPTY_NODE_MAP
  }
  let nodeSlicesCache: NodeSlices = {
    ordered: EMPTY_NODES,
    visible: EMPTY_NODES,
    canvas: EMPTY_NODES,
    canvasNodeById: EMPTY_NODE_MAP,
    indexes: indexesCache
  }

  return atom((get) => {
    const doc = get(documentAtom)
    const nodes = doc.nodes
    if (!nodes.length) {
      previousNodesRef = nodes
      previousOrderRef = doc.order?.nodes
      orderedCache = EMPTY_NODES
      visibleCache = EMPTY_NODES
      canvasCache = EMPTY_NODES
      canvasNodeByIdCache = EMPTY_NODE_MAP
      indexesCache = {
        canvasNodeById: EMPTY_NODE_MAP
      }
      nodeSlicesCache = {
        ordered: EMPTY_NODES,
        visible: EMPTY_NODES,
        canvas: EMPTY_NODES,
        canvasNodeById: EMPTY_NODE_MAP,
        indexes: indexesCache
      }
      return nodeSlicesCache
    }

    const orderRef = doc.order?.nodes
    if (nodes !== previousNodesRef || orderRef !== previousOrderRef) {
      const next = deriveNodeReadSlices(nodes, orderRef)
      const normalizedVisible = next.visible.length ? next.visible : EMPTY_NODES
      const normalizedCanvas = next.canvas.length ? next.canvas : EMPTY_NODES
      const normalizedCanvasNodeById = next.canvasNodeById.size
        ? next.canvasNodeById
        : EMPTY_NODE_MAP

      const nextOrderedCache = isSameRefOrder(orderedCache, next.ordered)
        ? orderedCache
        : next.ordered
      const nextVisibleCache = isSameRefOrder(visibleCache, normalizedVisible)
        ? visibleCache
        : normalizedVisible
      const nextCanvasCache = isSameRefOrder(canvasCache, normalizedCanvas)
        ? canvasCache
        : normalizedCanvas

      const nextCanvasNodeByIdCache = nextCanvasCache === canvasCache ||
        isSameMapValueRefs(canvasNodeByIdCache, normalizedCanvasNodeById)
        ? canvasNodeByIdCache
        : normalizedCanvasNodeById

      const nextIndexesCache = nextCanvasNodeByIdCache === canvasNodeByIdCache
        ? indexesCache
        : {
          canvasNodeById: nextCanvasNodeByIdCache
        }

      orderedCache = nextOrderedCache
      visibleCache = nextVisibleCache
      canvasCache = nextCanvasCache
      canvasNodeByIdCache = nextCanvasNodeByIdCache
      indexesCache = nextIndexesCache

      previousNodesRef = nodes
      previousOrderRef = orderRef
    }

    if (
      nodeSlicesCache.ordered === orderedCache &&
      nodeSlicesCache.visible === visibleCache &&
      nodeSlicesCache.canvas === canvasCache &&
      nodeSlicesCache.canvasNodeById === canvasNodeByIdCache &&
      nodeSlicesCache.indexes === indexesCache
    ) {
      return nodeSlicesCache
    }

    nodeSlicesCache = {
      ordered: orderedCache,
      visible: visibleCache,
      canvas: canvasCache,
      canvasNodeById: canvasNodeByIdCache,
      indexes: indexesCache
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

export const indexes = (
  nodeSlicesAtom: Atom<NodeSlices>
): Atom<ReadModelSnapshot['indexes']> =>
  atom((get) => get(nodeSlicesAtom).indexes)
