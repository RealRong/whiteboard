import type { QueryCanvas } from '@engine-types/instance/query'
import {
  getNodeIdsInRect as getNodeIdsInRectRaw,
  isBackgroundTarget as isBackgroundTargetRaw
} from '../actors/node/query'
import type { QueryIndexes } from './Indexes'

type Options = {
  indexes: QueryIndexes
  getContainer: () => HTMLDivElement | null
  ensureIndexesSynced: () => void
}

export const createCanvas = ({
  indexes,
  getContainer,
  ensureIndexesSynced
}: Options): QueryCanvas => {
  const nodeRects: QueryCanvas['nodeRects'] = () => {
    ensureIndexesSynced()
    return indexes.getNodeRects()
  }

  const nodeRect: QueryCanvas['nodeRect'] = (nodeId) => {
    ensureIndexesSynced()
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
    nodeRects,
    nodeRect,
    nodeIdsInRect,
    isBackgroundTarget
  }
}
