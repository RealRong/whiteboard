import { atom, type Atom } from 'jotai/vanilla'
import type { Node, NodeId, Viewport } from '@whiteboard/core/types'
import { toLayerOrderedCanvasNodeIds } from '@whiteboard/core/node'
import { isSameRefOrder } from '@whiteboard/core/utils'
import {
  READ_PUBLIC_KEYS,
  READ_SUBSCRIBE_KEYS,
  type NodeViewItem,
  type ViewportTransformView
} from '@engine-types/instance/read'
import type {
  ReadRuntimeContext
} from '../context'

export type NodeReadAtoms = {
  viewportTransform: Atom<ViewportTransformView>
  nodeIds: Atom<NodeId[]>
  nodeById: (id: NodeId) => Atom<NodeViewItem | undefined>
}

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

export const atoms = (context: ReadRuntimeContext): NodeReadAtoms => {
  const viewportAtom = context.atom(READ_PUBLIC_KEYS.viewport)
  const readSnapshotAtom = context.atom(READ_SUBSCRIBE_KEYS.snapshot)
  const getNodeRect = context.query.canvas.nodeRect

  let nodeIdsCache: NodeId[] = []
  let nodeIdsSourceRef: Node[] | undefined
  const getNodeIds = (canvasNodes: Node[]) => {
    if (canvasNodes === nodeIdsSourceRef) return nodeIdsCache

    const next = toLayerOrderedCanvasNodeIds(canvasNodes)
    if (isSameRefOrder(nodeIdsCache, next)) {
      nodeIdsSourceRef = canvasNodes
      return nodeIdsCache
    }

    nodeIdsSourceRef = canvasNodes
    nodeIdsCache = next
    return nodeIdsCache
  }

  const nodeByIdAtoms = new Map<NodeId, Atom<NodeViewItem | undefined>>()
  const nodeItemCacheById = new Map<NodeId, NodeViewItem>()

  const viewportTransformAtom = atom((get) =>
    toViewportTransform(get(viewportAtom))
  )

  const nodeIdsAtom = atom((get) => {
    const snapshot = get(readSnapshotAtom)
    return getNodeIds(snapshot.nodes.canvas)
  })

  const nodeById = (id: NodeId) => {
    const cached = nodeByIdAtoms.get(id)
    if (cached) return cached

    const nextAtom = atom((get) => {
      const snapshot = get(readSnapshotAtom)
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
    })

    nodeByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  return {
    viewportTransform: viewportTransformAtom,
    nodeIds: nodeIdsAtom,
    nodeById
  }
}
