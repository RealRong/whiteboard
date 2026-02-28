import { toLayerOrderedCanvasNodes } from '@whiteboard/core/node'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { Change } from '../../write/pipeline/ChangeBus'

type NodeModelOptions = {
  readSnapshot: () => ReadModelSnapshot
}

export type NodeReadModel = {
  applyChange: (change: Change) => void
  getNodeIds: () => NodeId[]
}

const isSameNodeOrder = (left: readonly string[], right: readonly string[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const createNodeModel = ({
  readSnapshot
}: NodeModelOptions): NodeReadModel => {
  let nodeIdsCache: NodeId[] = []
  let nodeIdsSourceRef: Node[] | undefined

  const getNodeIds: NodeReadModel['getNodeIds'] = () => {
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

  return {
    applyChange: () => {
      // Node read model relies on readSnapshot references; no explicit invalidation required.
    },
    getNodeIds
  }
}
