import type { Node, NodeId } from '@whiteboard/core/types'
import { toLayerOrderedCanvasNodes } from '@whiteboard/core/node'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { ReadRuntimeContext } from '../context'
import type { ReadFeature } from '../featureTypes'
import { view as createNodeView } from './view'

type NodeReadAtomKey = 'viewportTransform' | 'nodeIds' | 'nodeById'

type NodeReadGetterKey = NodeReadAtomKey

export type NodeReadFeature = ReadFeature<NodeReadAtomKey, NodeReadGetterKey>

const isSameNodeOrder = (left: readonly string[], right: readonly string[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const feature = (context: ReadRuntimeContext): NodeReadFeature => {
  const readSnapshot = (): ReadModelSnapshot => context.get('snapshot')

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

  const atoms = createNodeView({
    viewportAtom: context.atom('viewport'),
    readSnapshotAtom: context.atom('snapshot'),
    getNodeRect: context.query.nodeRect,
    getNodeIds
  })

  return {
    atoms,
    get: {
      viewportTransform: () => context.readAtom(atoms.viewportTransform),
      nodeIds: () => context.readAtom(atoms.nodeIds),
      nodeById: (id) => context.readAtom(atoms.nodeById(id))
    }
  }
}
