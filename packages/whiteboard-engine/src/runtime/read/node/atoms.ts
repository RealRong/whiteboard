import { atom, type Atom } from 'jotai/vanilla'
import type { NodeId, Viewport } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type {
  NodeViewItem,
  ViewportTransformView
} from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { StateAtoms } from '../../../state/factory/CreateState'

type NodeViewOptions = {
  viewportAtom: StateAtoms['viewport']
  readSnapshotAtom: Atom<ReadModelSnapshot>
  getNodeRect: QueryCanvas['nodeRect']
  getNodeIds: () => NodeId[]
}

export type NodeViewAtoms = {
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

export const view = ({
  viewportAtom,
  readSnapshotAtom,
  getNodeRect,
  getNodeIds
}: NodeViewOptions): NodeViewAtoms => {
  const nodeByIdAtoms = new Map<NodeId, Atom<NodeViewItem | undefined>>()
  const nodeItemCacheById = new Map<NodeId, NodeViewItem>()

  const viewportTransformAtom = atom((get) =>
    toViewportTransform(get(viewportAtom))
  )

  const nodeIdsAtom = atom((get) => {
    get(readSnapshotAtom)
    return getNodeIds()
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
