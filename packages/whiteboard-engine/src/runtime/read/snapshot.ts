import { atom, type Atom, type PrimitiveAtom } from 'jotai/vanilla'
import {
  deriveNodeReadSlices,
  deriveVisibleEdges
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
import type { ReadModelSnapshot } from '@engine-types/read/snapshot'

const isSameSnapshotRefs = (
  cache: ReadModelSnapshot | undefined,
  {
    revision,
    docId,
    visibleNodes,
    canvasNodes,
    visibleEdges,
    canvasNodeById
  }: {
    revision: number
    docId: string
    visibleNodes: Node[]
    canvasNodes: Node[]
    visibleEdges: Edge[]
    canvasNodeById: ReadModelSnapshot['indexes']['canvasNodeById']
  }
): cache is ReadModelSnapshot => {
  if (!cache) return false
  return (
    cache.revision === revision &&
    cache.docId === docId &&
    cache.nodes.visible === visibleNodes &&
    cache.nodes.canvas === canvasNodes &&
    cache.edges.visible === visibleEdges &&
    cache.indexes.canvasNodeById === canvasNodeById
  )
}

export const snapshot = ({
  documentAtom,
  revisionAtom
}: {
  documentAtom: PrimitiveAtom<Document>
  revisionAtom: PrimitiveAtom<number>
}): Atom<ReadModelSnapshot> => {
  const EMPTY_NODES: Node[] = []
  const EMPTY_EDGES: Edge[] = []
  const EMPTY_NODE_MAP = new Map<NodeId, Node>()

  let previousNodesRef: Document['nodes'] | undefined
  let previousNodeOrderRef: Document['order'] extends { nodes?: infer TOrder }
    ? TOrder
    : NodeId[] | undefined
  let visibleNodesCache: Node[] = EMPTY_NODES
  let canvasNodesCache: Node[] = EMPTY_NODES
  let canvasNodeByIdCache: Map<NodeId, Node> = EMPTY_NODE_MAP
  let indexesCache: ReadModelSnapshot['indexes'] = {
    canvasNodeById: EMPTY_NODE_MAP
  }

  type EdgeVisibleCache = {
    edgesRef: Document['edges']
    edgeOrderRef: Document['order'] extends { edges?: infer TOrder }
      ? TOrder
      : string[] | undefined
    canvasNodes: Node[]
    visibleEdges: Edge[]
  }
  let edgeVisibleCache: EdgeVisibleCache | undefined

  let cache: ReadModelSnapshot | undefined

  return atom((get) => {
    const doc = get(documentAtom)
    const revision = get(revisionAtom)
    const nodes = doc.nodes
    const nodeOrderRef = doc.order?.nodes

    if (!nodes.length) {
      previousNodesRef = nodes
      previousNodeOrderRef = nodeOrderRef
      visibleNodesCache = EMPTY_NODES
      canvasNodesCache = EMPTY_NODES
      canvasNodeByIdCache = EMPTY_NODE_MAP
      indexesCache = {
        canvasNodeById: EMPTY_NODE_MAP
      }
    } else if (
      nodes !== previousNodesRef ||
      nodeOrderRef !== previousNodeOrderRef
    ) {
      const previousCanvasNodesCache = canvasNodesCache
      const next = deriveNodeReadSlices(nodes, nodeOrderRef)
      const normalizedVisible = next.visible.length ? next.visible : EMPTY_NODES
      const normalizedCanvas = next.canvas.length ? next.canvas : EMPTY_NODES
      const normalizedCanvasNodeById = next.canvasNodeById.size
        ? next.canvasNodeById
        : EMPTY_NODE_MAP

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
      indexesCache = indexesCache.canvasNodeById === canvasNodeByIdCache
        ? indexesCache
        : {
          canvasNodeById: canvasNodeByIdCache
        }

      previousNodesRef = nodes
      previousNodeOrderRef = nodeOrderRef
    }

    const edgeOrderRef = doc.order?.edges
    let visibleEdgesCache: Edge[]
    if (!doc.edges.length || !canvasNodesCache.length) {
      visibleEdgesCache = EMPTY_EDGES
      edgeVisibleCache = {
        edgesRef: doc.edges,
        edgeOrderRef,
        canvasNodes: canvasNodesCache,
        visibleEdges: visibleEdgesCache
      }
    } else if (
      edgeVisibleCache &&
      edgeVisibleCache.edgesRef === doc.edges &&
      edgeVisibleCache.edgeOrderRef === edgeOrderRef &&
      isSameIdOrder(edgeVisibleCache.canvasNodes, canvasNodesCache)
    ) {
      visibleEdgesCache = edgeVisibleCache.visibleEdges
    } else {
      const nextVisibleEdges = deriveVisibleEdges(
        doc.edges,
        canvasNodesCache,
        edgeOrderRef
      )
      visibleEdgesCache = nextVisibleEdges.length ? nextVisibleEdges : EMPTY_EDGES
      edgeVisibleCache = {
        edgesRef: doc.edges,
        edgeOrderRef,
        canvasNodes: canvasNodesCache,
        visibleEdges: visibleEdgesCache
      }
    }

    if (isSameSnapshotRefs(cache, {
      revision,
      docId: doc.id,
      visibleNodes: visibleNodesCache,
      canvasNodes: canvasNodesCache,
      visibleEdges: visibleEdgesCache,
      canvasNodeById: indexesCache.canvasNodeById
    })) {
      return cache
    }

    cache = {
      revision,
      docId: doc.id,
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
  })
}
