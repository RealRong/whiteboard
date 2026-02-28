import type { createStore } from 'jotai/vanilla'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { NodeViewItem, ViewportTransformView } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { Atom } from 'jotai/vanilla'
import type { StateAtoms } from '../../../state/factory/CreateState'
import { toLayerOrderedCanvasNodes } from '@whiteboard/core/node'
import type { Change } from '../../write/pipeline/ChangeBus'
import { view, type NodeViewAtoms } from './view'

type NodeOptions = {
  store: ReturnType<typeof createStore>
  viewportAtom: StateAtoms['viewport']
  readSnapshotAtom: Atom<ReadModelSnapshot>
  readSnapshot: () => ReadModelSnapshot
  getNodeRect: QueryCanvas['nodeRect']
}

export type NodeReadDomain = {
  atoms: NodeViewAtoms
  applyChange?: (change: Change) => void
  get: {
    viewportTransform: () => ViewportTransformView
    nodeIds: () => NodeId[]
    nodeById: (id: NodeId) => NodeViewItem | undefined
  }
}

const isSameNodeOrder = (left: readonly string[], right: readonly string[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const domain = ({
  store,
  viewportAtom,
  readSnapshotAtom,
  readSnapshot,
  getNodeRect
}: NodeOptions): NodeReadDomain => {
  let nodeIdsCache: NodeId[] = []
  let nodeIdsSourceRef: Node[] | undefined

  const getNodeIds = () => {
    const canvasNodes = readSnapshot().nodes.canvas
    if (canvasNodes === nodeIdsSourceRef) return nodeIdsCache

    const next = toLayerOrderedCanvasNodes(canvasNodes).map((node) => node.id)
    if (isSameNodeOrder(nodeIdsCache, next)) {
      nodeIdsSourceRef = canvasNodes
      return nodeIdsCache
    }

    nodeIdsSourceRef = canvasNodes
    nodeIdsCache = next
    return nodeIdsCache
  }

  const atoms = view({
    viewportAtom,
    readSnapshotAtom,
    getNodeRect,
    getNodeIds
  })

  return {
    atoms,
    get: {
      viewportTransform: () => store.get(atoms.viewportTransform),
      nodeIds: () => store.get(atoms.nodeIds),
      nodeById: (id) => store.get(atoms.nodeById(id))
    }
  }
}
