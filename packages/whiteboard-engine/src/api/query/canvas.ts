import type {
  InstanceConfig,
  Query,
  State
} from '@engine-types/instance'
import { getNodeAABB, getNodeRect } from '../../infra/geometry'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegmentIndexAtWorld as getNearestEdgeSegmentIndexAtWorldRaw,
  getNodeIdsInRect as getNodeIdsInRectRaw,
  isCanvasBackgroundTarget as isCanvasBackgroundTargetRaw
} from '../../infra/query'

type Options = {
  readState: State['read']
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createCanvasQuery = ({
  readState,
  config,
  getContainer
}: Options): Pick<
  Query,
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

  const getCanvasNodeRects: Query['getCanvasNodeRects'] = () => {
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

  const getCanvasNodeRectById: Query['getCanvasNodeRectById'] = (nodeId) => {
    getCanvasNodeRects()
    return cachedById.get(nodeId)
  }

  const getNodeIdsInRect: Query['getNodeIdsInRect'] = (rect) =>
    getNodeIdsInRectRaw(rect, getCanvasNodeRects())

  const isCanvasBackgroundTarget: Query['isCanvasBackgroundTarget'] = (target) =>
    isCanvasBackgroundTargetRaw({
      container: getContainer(),
      target
    })

  const getAnchorFromPoint: Query['getAnchorFromPoint'] = (rect, rotation, point) =>
    getAnchorFromPointRaw(rect, rotation, point, {
      snapMin: config.edge.anchorSnapMin,
      snapRatio: config.edge.anchorSnapRatio
    })

  const getNearestEdgeSegmentIndexAtWorld: Query['getNearestEdgeSegmentIndexAtWorld'] = (
    pointWorld,
    pathPoints
  ) => getNearestEdgeSegmentIndexAtWorldRaw(pointWorld, pathPoints)

  return {
    getCanvasNodeRects,
    getCanvasNodeRectById,
    getNodeIdsInRect,
    isCanvasBackgroundTarget,
    getAnchorFromPoint,
    getNearestEdgeSegmentIndexAtWorld
  }
}
