import type { QueryCanvas } from '@engine-types/instance/query'
import { getNodeIdsInRect as getNodeIdsInRectRaw } from '../actors/node/query'
import type { QueryIndexes } from './Indexes'

type Options = {
  indexes: QueryIndexes
  ensureIndexes: () => void
}

export const createCanvas = ({
  indexes,
  ensureIndexes
}: Options): QueryCanvas => {
  const nodeRects: QueryCanvas['nodeRects'] = () => {
    ensureIndexes()
    return indexes.getNodeRects()
  }

  const nodeRect: QueryCanvas['nodeRect'] = (nodeId) => {
    ensureIndexes()
    return indexes.getNodeRectById(nodeId)
  }

  const nodeIdsInRect: QueryCanvas['nodeIdsInRect'] = (rect) =>
    getNodeIdsInRectRaw(rect, nodeRects())

  return {
    nodeRects,
    nodeRect,
    nodeIdsInRect
  }
}
