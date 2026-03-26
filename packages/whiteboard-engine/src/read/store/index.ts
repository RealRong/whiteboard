import type { ReadModel } from '@engine-types/read'
import type { EngineDocument, EngineRead, EngineReadIndex } from '@engine-types/instance'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { BoardConfig } from '@whiteboard/core/config'
import type { MindmapLayoutConfig } from '@whiteboard/core/mindmap'
import {
  getEdgePath,
  getEdgePathBounds
} from '@whiteboard/core/edge'
import {
  getNodeAABB,
  getAABBFromPoints,
  getRectsBoundingRect
} from '@whiteboard/core/geometry'
import { createValueStore } from '@whiteboard/core/runtime'
import {
  exportSliceFromSelection,
  exportSliceFromEdge,
  exportSliceFromNodes
} from '@whiteboard/core/document'
import {
  getNodeOutlineBounds,
  getTargetBounds
} from '@whiteboard/core/node'
import {
  listNodes,
  type EdgeId,
  type NodeId,
  type Rect
} from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../config'
import { RESET_READ_IMPACT } from '../impacts'
import { NodeRectIndex, SnapIndex, TreeIndex } from '../indexes'
import { createEdgeProjection } from './edge'
import { createReadModel } from './model'
import { createMindmapProjection } from './mindmap'
import { createNodeProjection } from './node'
import { createTreeProjection } from './tree'
import type { ReadSnapshot } from './types'

export const createRead = ({
  document,
  mindmapLayout,
  config
}: {
  document: EngineDocument
  mindmapLayout: () => MindmapLayoutConfig
  config: BoardConfig
}): {
  read: EngineRead
  invalidate: (impact: KernelReadImpact) => void
} => {
  const readDocument = document.get
  const readModel = createReadModel({ readDocument })

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const treeIndex = new TreeIndex()
  const index: EngineReadIndex = {
    node: {
      all: nodeRectIndex.all,
      get: nodeRectIndex.byId,
      idsInRect: nodeRectIndex.nodeIdsInRect
    },
    snap: {
      all: snapIndex.all,
      inRect: snapIndex.queryInRect
    }
  }

  const createSnapshot = (model: ReadModel): ReadSnapshot => ({
    model,
    index
  })
  const background = createValueStore(readDocument().background)

  const syncIndexes = (impact: KernelReadImpact, model: ReadModel) => {
    nodeRectIndex.applyChange(impact, model)
    snapIndex.applyChange(impact, {
      all: nodeRectIndex.all,
      get: nodeRectIndex.byId
    })
    treeIndex.applyChange(model)
  }

  const initialModel = readModel()
  syncIndexes(RESET_READ_IMPACT, initialModel)
  const initialSnapshot = createSnapshot(initialModel)

  const nodeProjection = createNodeProjection(initialSnapshot)
  const edgeProjection = createEdgeProjection(initialSnapshot)
  const mindmapProjection = createMindmapProjection(initialSnapshot, {
    config,
    mindmapLayout
  })
  const treeProjection = createTreeProjection({
    readIds: treeIndex.ids
  })

  const readProjectedNodeBounds = (nodeId: NodeId): Rect | undefined => {
    const item = nodeProjection.item.get(nodeId)
    if (!item) {
      return undefined
    }

    const rotation = typeof item.node.rotation === 'number'
      ? item.node.rotation
      : 0

    return item.node.type === 'shape'
      ? getNodeOutlineBounds(item.node, item.rect, rotation)
      : getNodeAABB(item.node, item.rect)
  }

  const readEdgeBounds = (edgeId: EdgeId): Rect | undefined => {
    const item = edgeProjection.item.get(edgeId)
    if (!item) {
      return undefined
    }

    const path = getEdgePath({
      edge: item.edge,
      source: {
        point: item.ends.source.point,
        side: item.ends.source.anchor?.side
      },
      target: {
        point: item.ends.target.point,
        side: item.ends.target.anchor?.side
      }
    })
    return getEdgePathBounds(path)
  }

  const readMindmapBounds = (treeId: NodeId): Rect | undefined => {
    const item = mindmapProjection.item.get(treeId)
    if (!item) {
      return undefined
    }

    return {
      x: item.node.position.x + item.computed.bbox.x,
      y: item.node.position.y + item.computed.bbox.y,
      width: item.computed.bbox.width,
      height: item.computed.bbox.height
    }
  }

  const readCanvasBounds = (): Rect | undefined => {
    const rects: Rect[] = nodeRectIndex.all().map((entry) => entry.aabb)

    edgeProjection.list.get().forEach((edgeId) => {
      const rect = readEdgeBounds(edgeId)
      if (rect) {
        rects.push(rect)
      }
    })

    mindmapProjection.list.get().forEach((treeId) => {
      const rect = readMindmapBounds(treeId)
      if (rect) {
        rects.push(rect)
      }
    })

    return getRectsBoundingRect(rects)
  }

  const readTargetBounds = (input: Parameters<typeof getTargetBounds>[0]['input']) =>
    getTargetBounds({
      input,
      nodes: listNodes(readDocument()),
      readNodeBounds: readProjectedNodeBounds,
      readEdgeBounds
    })

  const applyImpact = (impact: KernelReadImpact) => {
    if (impact.reset || impact.document) {
      background.set(readDocument().background)
    }

    const model = readModel()
    syncIndexes(impact, model)
    const snapshot = createSnapshot(model)
    nodeProjection.applyChange(impact, snapshot)
    edgeProjection.applyChange(impact, snapshot)
    mindmapProjection.applyChange(impact, snapshot)
    treeProjection.applyChange()
  }

  return {
    read: {
      document: {
        background
      },
      bounds: {
        canvas: readCanvasBounds,
        targets: readTargetBounds
      },
      node: {
        list: nodeProjection.list,
        item: nodeProjection.item
      },
      edge: {
        list: edgeProjection.list,
        item: edgeProjection.item,
        related: edgeProjection.related
      },
      mindmap: {
        list: mindmapProjection.list,
        item: mindmapProjection.item
      },
      tree: treeProjection.item,
      slice: {
        fromNodes: (nodeIds) => {
          const exported = exportSliceFromNodes({
            doc: readDocument(),
            ids: nodeIds,
            nodeSize: config.nodeSize
          })
          return exported.ok ? exported.data : undefined
        },
        fromEdge: (edgeId) => {
          const exported = exportSliceFromEdge({
            doc: readDocument(),
            edgeId,
            nodeSize: config.nodeSize
          })
          return exported.ok ? exported.data : undefined
        },
        fromSelection: (selection) => {
          const exported = exportSliceFromSelection({
            doc: readDocument(),
            nodeIds: selection.nodeIds,
            edgeIds: selection.edgeIds,
            nodeSize: config.nodeSize
          })
          return exported.ok ? exported.data : undefined
        }
      },
      index
    },
    invalidate: applyImpact
  }
}
