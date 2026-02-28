import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '@engine-types/instance/read'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { SnapCandidate } from '@engine-types/node/snap'
import { DEFAULT_TUNING } from '../../../config'
import { NodeRectIndex } from './NodeRectIndex'
import { SnapIndex } from './SnapIndex'

export type IndexStore = {
  sync: (nodes: Node[]) => void
  syncByNodeIds: (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ) => void
  getNodeRects: () => CanvasNodeRect[]
  getNodeRectById: (nodeId: NodeId) => CanvasNodeRect | undefined
  getSnapCandidates: () => SnapCandidate[]
  getSnapCandidatesInRect: (rect: Rect) => SnapCandidate[]
}

type IndexStoreOptions = {
  config: InstanceConfig
}

export const store = ({
  config
}: IndexStoreOptions): IndexStore => {
  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(() =>
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )

  const sync: IndexStore['sync'] = (nodes) => {
    nodeRectIndex.updateFull(nodes)
    snapIndex.update(nodeRectIndex.getAll())
  }

  const syncByNodeIds: IndexStore['syncByNodeIds'] = (nodeIds, nodeById) => {
    const changed = nodeRectIndex.updateByIds(nodeIds, nodeById)
    if (!changed) return
    snapIndex.updateByNodeIds(nodeIds, nodeRectIndex.getById)
  }

  return {
    sync,
    syncByNodeIds,
    getNodeRects: () => nodeRectIndex.getAll(),
    getNodeRectById: (nodeId) => nodeRectIndex.getById(nodeId),
    getSnapCandidates: () => snapIndex.getAll(),
    getSnapCandidatesInRect: (rect) => snapIndex.queryInRect(rect)
  }
}
