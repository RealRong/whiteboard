import {
  deriveNodeReadSlices,
  deriveVisibleEdges,
  toLayerOrderedCanvasNodeIds
} from '@whiteboard/core/node'
import {
  isSameIdOrder,
  isSameMapValueRefs,
  isSameRefOrder
} from '@whiteboard/core/utils'
import type {
  Document,
  Edge,
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { ReadModel } from '@engine-types/read/model'

const isSameModelRefs = (
  cache: ReadModel | undefined,
  {
    visibleNodes,
    canvasNodes,
    visibleEdges,
    canvasNodeById,
    canvasNodeIds
  }: {
    visibleNodes: Node[]
    canvasNodes: Node[]
    visibleEdges: Edge[]
    canvasNodeById: ReadModel['indexes']['canvasNodeById']
    canvasNodeIds: ReadModel['indexes']['canvasNodeIds']
  }
): cache is ReadModel => {
  if (!cache) return false
  return (
    cache.nodes.visible === visibleNodes &&
    cache.nodes.canvas === canvasNodes &&
    cache.edges.visible === visibleEdges &&
    cache.indexes.canvasNodeById === canvasNodeById &&
    cache.indexes.canvasNodeIds === canvasNodeIds
  )
}

export const createReadModel = ({
  readDocument
}: {
  readDocument: () => Document
}) => {
  const EMPTY_NODES: Node[] = []
  const EMPTY_EDGES: Edge[] = []
  const EMPTY_NODE_IDS: NodeId[] = []
  const EMPTY_NODE_MAP = new Map<NodeId, Node>()

  let previousDocumentRef: Document | undefined
  let previousNodesRef: Document['nodes'] | undefined
  let visibleNodesCache: Node[] = EMPTY_NODES
  let canvasNodesCache: Node[] = EMPTY_NODES
  let canvasNodeByIdCache: Map<NodeId, Node> = EMPTY_NODE_MAP
  let canvasNodeIdsCache: NodeId[] = EMPTY_NODE_IDS
  let indexesCache: ReadModel['indexes'] = {
    canvasNodeById: EMPTY_NODE_MAP,
    canvasNodeIds: EMPTY_NODE_IDS
  }

  type EdgeVisibleCache = {
    edgesRef: Document['edges']
    canvasNodes: Node[]
    visibleEdges: Edge[]
  }
  let edgeVisibleCache: EdgeVisibleCache | undefined

  let cache: ReadModel | undefined

  return (): ReadModel => {
    const doc = readDocument()
    if (cache && previousDocumentRef === doc) {
      return cache
    }

    const nodes = doc.nodes

    if (!nodes.order.length) {
      previousNodesRef = nodes
      visibleNodesCache = EMPTY_NODES
      canvasNodesCache = EMPTY_NODES
      canvasNodeByIdCache = EMPTY_NODE_MAP
      canvasNodeIdsCache = EMPTY_NODE_IDS
      indexesCache = {
        canvasNodeById: EMPTY_NODE_MAP,
        canvasNodeIds: EMPTY_NODE_IDS
      }
    } else if (nodes !== previousNodesRef) {
      const previousCanvasNodesCache = canvasNodesCache
      const next = deriveNodeReadSlices(nodes)
      const normalizedVisible = next.visible.length ? next.visible : EMPTY_NODES
      const normalizedCanvas = next.canvas.length ? next.canvas : EMPTY_NODES
      const normalizedCanvasNodeById = next.canvasNodeById.size
        ? next.canvasNodeById
        : EMPTY_NODE_MAP
      const normalizedCanvasNodeIds = normalizedCanvas.length
        ? toLayerOrderedCanvasNodeIds(normalizedCanvas)
        : EMPTY_NODE_IDS

      visibleNodesCache = isSameRefOrder(visibleNodesCache, normalizedVisible)
        ? visibleNodesCache
        : normalizedVisible
      canvasNodesCache = isSameRefOrder(canvasNodesCache, normalizedCanvas)
        ? canvasNodesCache
        : normalizedCanvas
      canvasNodeByIdCache = canvasNodesCache === previousCanvasNodesCache ||
        isSameMapValueRefs(canvasNodeByIdCache, normalizedCanvasNodeById)
        ? canvasNodeByIdCache
        : normalizedCanvasNodeById
      canvasNodeIdsCache = isSameRefOrder(canvasNodeIdsCache, normalizedCanvasNodeIds)
        ? canvasNodeIdsCache
        : normalizedCanvasNodeIds
      indexesCache = (
        indexesCache.canvasNodeById === canvasNodeByIdCache &&
        indexesCache.canvasNodeIds === canvasNodeIdsCache
      )
        ? indexesCache
        : {
            canvasNodeById: canvasNodeByIdCache,
            canvasNodeIds: canvasNodeIdsCache
          }

      previousNodesRef = nodes
    }

    let visibleEdgesCache: Edge[]
    if (!doc.edges.order.length || !canvasNodesCache.length) {
      visibleEdgesCache = EMPTY_EDGES
      edgeVisibleCache = {
        edgesRef: doc.edges,
        canvasNodes: canvasNodesCache,
        visibleEdges: visibleEdgesCache
      }
    } else if (
      edgeVisibleCache &&
      edgeVisibleCache.edgesRef === doc.edges &&
      isSameIdOrder(edgeVisibleCache.canvasNodes, canvasNodesCache)
    ) {
      visibleEdgesCache = edgeVisibleCache.visibleEdges
    } else {
      const nextVisibleEdges = deriveVisibleEdges(
        doc.edges,
        canvasNodesCache
      )
      visibleEdgesCache = nextVisibleEdges.length ? nextVisibleEdges : EMPTY_EDGES
      edgeVisibleCache = {
        edgesRef: doc.edges,
        canvasNodes: canvasNodesCache,
        visibleEdges: visibleEdgesCache
      }
    }

    previousDocumentRef = doc
    if (isSameModelRefs(cache, {
      visibleNodes: visibleNodesCache,
      canvasNodes: canvasNodesCache,
      visibleEdges: visibleEdgesCache,
      canvasNodeById: indexesCache.canvasNodeById,
      canvasNodeIds: indexesCache.canvasNodeIds
    })) {
      return cache
    }

    cache = {
      nodes: {
        visible: visibleNodesCache,
        canvas: canvasNodesCache
      },
      edges: {
        visible: visibleEdgesCache
      },
      indexes: indexesCache
    }
    return cache
  }
}
