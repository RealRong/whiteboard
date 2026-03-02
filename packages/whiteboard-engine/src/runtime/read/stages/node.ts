import type { NodeId, Viewport } from '@whiteboard/core/types'
import {
  READ_SUBSCRIBE_KEYS,
  READ_PUBLIC_KEYS,
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

  return {
    get: {
      viewportTransform: () =>
        toViewportTransform(context.get(READ_PUBLIC_KEYS.viewport)),
      nodeIds: () => {
        const snapshot = context.get(READ_SUBSCRIBE_KEYS.snapshot)
        return snapshot.indexes.canvasNodeIds
      },
      nodeById: (id) => {
        const snapshot = context.get(READ_SUBSCRIBE_KEYS.snapshot)
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
    }
  }
}
