import type {
  NodeViewItem,
  NodesView
} from '@engine-types/instance/read'
import type { ReadContext } from '@engine-types/read/context'
import type { NodeReadProjection } from '@engine-types/read/projection/node'
import type { Node, NodeId } from '@whiteboard/core/types'

export const projection = (context: ReadContext): NodeReadProjection => {
  const nodeItemCacheById = new Map<NodeId, NodeViewItem>()
  let viewCache: NodesView | undefined
  let viewIdsRef: readonly NodeId[] | undefined
  let viewByIdRef: ReadonlyMap<NodeId, Node> | undefined

  const resolveNodeItem = (
    nodeById: ReadonlyMap<NodeId, Node>,
    id: NodeId
  ): NodeViewItem | undefined => {
    const node = nodeById.get(id)
    if (!node) {
      nodeItemCacheById.delete(id)
      return undefined
    }

    const rect = context.indexes.canvas.byId(id)?.rect ?? {
      x: node.position.x,
      y: node.position.y,
      width: node.size?.width ?? 0,
      height: node.size?.height ?? 0
    }
    const previous = nodeItemCacheById.get(id)
    if (previous && previous.node === node && previous.rect === rect) {
      return previous
    }

    const next: NodeViewItem = {
      node,
      rect
    }
    nodeItemCacheById.set(id, next)
    return next
  }

  const getView: NodeReadProjection['getView'] = () => {
    const model = context.model()
    const ids = model.indexes.canvasNodeIds
    const nodeById = model.indexes.canvasNodeById

    if (
      viewCache &&
      viewIdsRef === ids &&
      viewByIdRef === nodeById
    ) {
      return viewCache
    }

    const byId = new Map<NodeId, NodeViewItem>()
    const seenIds = new Set<NodeId>()
    ids.forEach((id) => {
      seenIds.add(id)
      const item = resolveNodeItem(nodeById, id)
      if (!item) return
      byId.set(id, item)
    })
    nodeItemCacheById.forEach((_, id) => {
      if (seenIds.has(id)) return
      nodeItemCacheById.delete(id)
    })

    viewIdsRef = ids
    viewByIdRef = nodeById
    viewCache = {
      ids,
      byId
    }
    return viewCache
  }

  return {
    getView
  }
}
