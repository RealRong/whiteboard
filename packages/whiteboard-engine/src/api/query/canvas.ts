import type { InstanceConfig, Query, QueryDebugMetric } from '@engine-types/instance'
import {
  getAnchorFromPoint as getAnchorFromPointRaw,
  getNearestEdgeSegment as getNearestEdgeSegmentRaw,
  getNodeIdsInRect as getNodeIdsInRectRaw,
  isBackgroundTarget as isBackgroundTargetRaw
} from '../../kernel/query'
import type { QueryIndexes } from './indexes'

type Options = {
  indexes: QueryIndexes
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

type CanvasQuery = Pick<
  Query,
  | 'getNodeRects'
  | 'getNodeRectById'
  | 'getNodeIdsInRect'
  | 'isBackgroundTarget'
  | 'getAnchorFromPoint'
  | 'getNearestEdgeSegment'
> & {
  debug: {
    getMetrics: () => QueryDebugMetric
    resetMetrics: () => void
  }
}

export const createCanvas = ({
  indexes,
  config,
  getContainer
}: Options): CanvasQuery => {
  const getNodeRects: Query['getNodeRects'] = () => indexes.getNodeRects()

  const getNodeRectById: Query['getNodeRectById'] = (nodeId) => {
    return indexes.getNodeRectById(nodeId)
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
    getNearestEdgeSegment,
    debug: {
      getMetrics: () => ({ ...indexes.getMetrics().canvas } as QueryDebugMetric),
      resetMetrics: () => {
        indexes.resetMetrics('canvas')
      }
    }
  }
}
