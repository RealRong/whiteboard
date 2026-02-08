import type { Store, WhiteboardInstanceConfig, WhiteboardInstanceQuery } from 'types/instance'
import { canvasNodesAtom } from '../../state'
import { getNodeAABB, getNodeRect } from '../../utils/geometry'

type CreateInstanceQueryOptions = {
  store: Store
  config: WhiteboardInstanceConfig
}

export const createInstanceQuery = ({ store, config }: CreateInstanceQueryOptions): WhiteboardInstanceQuery => {
  let cachedNodes = store.get(canvasNodesAtom)
  let cachedRects = cachedNodes.map((node) => ({
    node,
    rect: getNodeRect(node, config.nodeSize),
    aabb: getNodeAABB(node, config.nodeSize),
    rotation: typeof node.rotation === 'number' ? node.rotation : 0
  }))
  let cachedById = new Map(cachedRects.map((entry) => [entry.node.id, entry]))

  const getCanvasNodeRects: WhiteboardInstanceQuery['getCanvasNodeRects'] = () => {
    const nodes = store.get(canvasNodesAtom)
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

  return {
    getCanvasNodeRects,
    getCanvasNodeRectById
  }
}
