import type {
  InstanceConfig,
  Query,
  State
} from '@engine-types/instance'
import { getNodeAABB, getNodeRect } from '../../infra/geometry'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw,
  getNodeIdsInRect as getNodeIdsInRectRaw,
  isBackgroundTarget as isBackgroundTargetRaw
} from '../../infra/query'

type Options = {
  readState: State['read']
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createCanvas = ({
  readState,
  config,
  getContainer
}: Options): Pick<
  Query,
  | 'getNodeRects'
  | 'getNodeRectById'
  | 'getNodeIdsInRect'
  | 'isBackgroundTarget'
  | 'getAnchorFromPoint'
  | 'getNearestEdgeSegment'
> => {
  let cachedNodes = readState('canvasNodes')
  let cachedRects = cachedNodes.map((node) => ({
    node,
    rect: getNodeRect(node, config.nodeSize),
    aabb: getNodeAABB(node, config.nodeSize),
    rotation: typeof node.rotation === 'number' ? node.rotation : 0
  }))
  let cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))

  const getNodeRects: Query['getNodeRects'] = () => {
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

  const getNodeRectById: Query['getNodeRectById'] = (nodeId) => {
    getNodeRects()
    return cachedById.get(nodeId)
  }

  const getNodeIdsInRect: Query['getNodeIdsInRect'] = (rect) =>
    getNodeIdsInRectRaw(rect, getNodeRects())

  const isBackgroundTarget: Query['isBackgroundTarget'] = (target) =>
    isBackgroundTargetRaw({
      container: getContainer(),
      target
    })

  const getAnchorFromPoint: Query['getAnchorFromPoint'] = (rect, rotation, point) =>
    getAnchorFromPointRaw(rect, rotation, point, {
      snapMin: config.edge.anchorSnapMin,
      snapRatio: config.edge.anchorSnapRatio
    })

  const getNearestEdgeSegment: Query['getNearestEdgeSegment'] = (
    pointWorld,
    pathPoints
  ) => getNearestEdgeSegmentRaw(pointWorld, pathPoints)

  return {
    getNodeRects,
    getNodeRectById,
    getNodeIdsInRect,
    isBackgroundTarget,
    getAnchorFromPoint,
    getNearestEdgeSegment
  }
}
