import type { QueryCanvas, QueryDebugMetric } from '@engine-types/instance/query'
import {
  getNodeIdsInRect as getNodeIdsInRectRaw,
  isBackgroundTarget as isBackgroundTargetRaw
} from '../../runtime/actors/node/query'
import type { QueryIndexes } from './indexes'

type Options = {
  indexes: QueryIndexes
  getContainer: () => HTMLDivElement | null
}

type CanvasQuery = {
  query: QueryCanvas
  debug: {
    getMetrics: () => QueryDebugMetric
    resetMetrics: () => void
  }
}

export const createCanvas = ({
  indexes,
  getContainer
}: Options): CanvasQuery => {
  const nodeRects: QueryCanvas['nodeRects'] = () => indexes.getNodeRects()

  const nodeRect: QueryCanvas['nodeRect'] = (nodeId) => {
    return indexes.getNodeRectById(nodeId)
  }

  const nodeIdsInRect: QueryCanvas['nodeIdsInRect'] = (rect) =>
    getNodeIdsInRectRaw(rect, nodeRects())

  const isBackgroundTarget: QueryCanvas['isBackgroundTarget'] = (target) =>
    isBackgroundTargetRaw({
      container: getContainer(),
      target
    })

  return {
    query: {
      nodeRects,
      nodeRect,
      watchNodes: indexes.watchNodeChanges,
      nodeIdsInRect,
      isBackgroundTarget
    },
    debug: {
      getMetrics: () => ({ ...indexes.getMetrics().canvas } as QueryDebugMetric),
      resetMetrics: () => {
        indexes.resetMetrics('canvas')
      }
    }
  }
}
