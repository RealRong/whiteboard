import type { QueryCanvas } from '@engine-types/instance/query'
import { getNodeIdsInRect as getNodeIdsInRectRaw } from '@whiteboard/core/node'
import type { IndexStore } from '../index/store'

type Options = {
  indexes: IndexStore
}

export const canvas = ({
  indexes
}: Options): QueryCanvas => {
  const nodeRects: QueryCanvas['nodeRects'] = () => indexes.getNodeRects()

  const nodeRect: QueryCanvas['nodeRect'] = (nodeId) =>
    indexes.getNodeRectById(nodeId)

  const nodeIdsInRect: QueryCanvas['nodeIdsInRect'] = (rect) =>
    getNodeIdsInRectRaw(rect, nodeRects())

  return {
    nodeRects,
    nodeRect,
    nodeIdsInRect
  }
}
