import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace
} from '@engine-types/instance'
import { getNodeAABB, getNodeRect } from '../../infra/geometry'
import {
  getAnchorFromPoint,
  getNearestEdgeSegmentIndexAtWorld as getNearestEdgeSegmentIndexAtWorldQuery,
  getNodeIdsInRect as getNodeIdsInRectByEntries,
  isCanvasBackgroundTarget as isCanvasBackgroundTargetQuery
} from '../../infra/query'

type CreateCanvasQueryOptions = {
  readState: WhiteboardStateNamespace['read']
  config: WhiteboardInstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createCanvasQuery = ({
  readState,
  config,
  getContainer
}: CreateCanvasQueryOptions): Pick<
  WhiteboardInstanceQuery,
  | 'getCanvasNodeRects'
  | 'getCanvasNodeRectById'
  | 'getNodeIdsInRect'
  | 'isCanvasBackgroundTarget'
  | 'getAnchorFromPoint'
  | 'getNearestEdgeSegmentIndexAtWorld'
> => {
  let cachedNodes = readState('canvasNodes')
  let cachedRects = cachedNodes.map((node) => ({
    node,
    rect: getNodeRect(node, config.nodeSize),
    aabb: getNodeAABB(node, config.nodeSize),
    rotation: typeof node.rotation === 'number' ? node.rotation : 0
  }))
  let cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))

  const getCanvasNodeRects: WhiteboardInstanceQuery['getCanvasNodeRects'] = () => {
    const nodes = readState('canvasNodes')
    if (nodes === cachedNodes) return cachedRects
    cachedNodes = nodes
    cachedRects = nodes.map((node) => ({
      node,
      rect: getNodeRect(node, config.nodeSize),
      aabb: getNodeAABB(node, config.nodeSize),
      rotation: typeof node.rotation === 'number' ? node.rotation : 0
    }))
    cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))
    return cachedRects
  }

  const getCanvasNodeRectById: WhiteboardInstanceQuery['getCanvasNodeRectById'] = (nodeId) => {
    getCanvasNodeRects()
    return cachedById.get(nodeId)
  }

  const getNodeIdsInRect: WhiteboardInstanceQuery['getNodeIdsInRect'] = (rect) =>
    getNodeIdsInRectByEntries(rect, getCanvasNodeRects())

  const isCanvasBackgroundTarget: WhiteboardInstanceQuery['isCanvasBackgroundTarget'] = (target) =>
    isCanvasBackgroundTargetQuery({
      container: getContainer(),
      target
    })

  const getAnchorFromPointWithConfig: WhiteboardInstanceQuery['getAnchorFromPoint'] = (rect, rotation, point) =>
    getAnchorFromPoint(rect, rotation, point, {
      snapMin: config.edge.anchorSnapMin,
      snapRatio: config.edge.anchorSnapRatio
    })

  const getNearestEdgeSegmentIndexAtWorld: WhiteboardInstanceQuery['getNearestEdgeSegmentIndexAtWorld'] = (
    pointWorld,
    pathPoints
  ) => getNearestEdgeSegmentIndexAtWorldQuery(pointWorld, pathPoints)

  return {
    getCanvasNodeRects,
    getCanvasNodeRectById,
    getNodeIdsInRect,
    isCanvasBackgroundTarget,
    getAnchorFromPoint: getAnchorFromPointWithConfig,
    getNearestEdgeSegmentIndexAtWorld
  }
}
