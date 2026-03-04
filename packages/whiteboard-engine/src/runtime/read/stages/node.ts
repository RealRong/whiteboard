import type { Node, NodeId, Viewport } from '@whiteboard/core/types'
import {
  READ_SUBSCRIPTION_KEYS,
  READ_STATE_KEYS,
  type NodesView,
  type NodeViewItem,
  type ViewportTransformView
} from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '@engine-types/read/context'
import type { NodeReadRuntime } from '@engine-types/read/node'

const toViewportTransform = (viewport: Viewport): ViewportTransformView => {
  const zoom = viewport.zoom
  return {
    center: viewport.center,
    zoom,
    transform: `translate(50%, 50%) scale(${zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
    cssVars: {
      '--wb-zoom': `${zoom}`
    }
  }
}

export const node = (context: ReadRuntimeContext): NodeReadRuntime => {
  const getNodeRect = context.query.canvas.nodeRect
  const nodeItemCacheById = new Map<NodeId, NodeViewItem>()
  let nodeViewCache: NodesView | undefined
  let nodeViewIdsRef: readonly NodeId[] | undefined
  let nodeViewByIdRef: ReadonlyMap<NodeId, Node> | undefined

  const resolveNodeItem = (id: NodeId): NodeViewItem | undefined => {
    const snapshot = context.get(READ_SUBSCRIPTION_KEYS.snapshot)
    const node = snapshot.indexes.canvasNodeById.get(id)
    if (!node) {
      nodeItemCacheById.delete(id)
      return undefined
    }

    const rect = getNodeRect(id)?.rect ?? {
      x: node.position.x,
      y: node.position.y,
      width: node.size?.width ?? 0,
      height: node.size?.height ?? 0
    }
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    const transformBase = `translate(${rect.x}px, ${rect.y}px)`
    const previous = nodeItemCacheById.get(id)
    if (
      previous &&
      previous.node === node &&
      previous.rect === rect &&
      previous.container.rotation === rotation &&
      previous.container.transformBase === transformBase
    ) {
      return previous
    }

    const next: NodeViewItem = {
      node,
      rect,
      container: {
        transformBase,
        rotation,
        transformOrigin: 'center center'
      }
    }
    nodeItemCacheById.set(id, next)
    return next
  }

  return {
    get: {
      viewportTransform: () =>
        toViewportTransform(context.get(READ_STATE_KEYS.viewport)),
      node: () => {
        const snapshot = context.get(READ_SUBSCRIPTION_KEYS.snapshot)
        const ids = snapshot.indexes.canvasNodeIds
        const byIdRef = snapshot.indexes.canvasNodeById

        if (
          nodeViewCache &&
          nodeViewIdsRef === ids &&
          nodeViewByIdRef === byIdRef
        ) {
          return nodeViewCache
        }

        const byId = new Map<NodeId, NodeViewItem>()
        ids.forEach((id) => {
          const nodeItem = resolveNodeItem(id)
          if (!nodeItem) return
          byId.set(id, nodeItem)
        })

        nodeViewIdsRef = ids
        nodeViewByIdRef = byIdRef
        nodeViewCache = {
          ids,
          byId
        }
        return nodeViewCache
      }
    }
  }
}
