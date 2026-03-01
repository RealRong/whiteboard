import type {
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import { getNodeIdsInRect as getNodeIdsInRectRaw } from '@whiteboard/core/node'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { CanvasNodeRect } from '@engine-types/instance/read'
import type { SnapCandidate } from '@engine-types/node/snap'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import { DEFAULT_TUNING } from '../../config'
import { NodeRectIndex } from './index/NodeRectIndex'
import { SnapIndex } from './index/SnapIndex'
import type { ReadIndexChangePlan } from './changePlan'

export type ReadIndexRuntime = {
  query: {
    nodeRects: () => CanvasNodeRect[]
    nodeRect: (nodeId: NodeId) => CanvasNodeRect | undefined
    nodeIdsInRect: (rect: Rect) => NodeId[]
    snapCandidates: () => SnapCandidate[]
    snapCandidatesInRect: (rect: Rect) => SnapCandidate[]
  }
  applyPlan: (
    plan: ReadIndexChangePlan,
    snapshot: ReadModelSnapshot
  ) => void
}

export const indexRuntime = (
  config: InstanceConfig,
  initialCanvasNodes: Node[]
): ReadIndexRuntime => {
  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(() =>
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )

  const syncIndex = (nodes: Node[]) => {
    nodeRectIndex.updateFull(nodes)
    snapIndex.update(nodeRectIndex.getAll())
  }

  const syncIndexByNodeIds = (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ) => {
    const changed = nodeRectIndex.updateByIds(nodeIds, nodeById)
    if (!changed) return
    snapIndex.updateByNodeIds(nodeIds, nodeRectIndex.getById)
  }

  syncIndex(initialCanvasNodes)

  const query: ReadIndexRuntime['query'] = {
    nodeRects: () => nodeRectIndex.getAll(),
    nodeRect: (nodeId) => nodeRectIndex.getById(nodeId),
    nodeIdsInRect: (rect) => getNodeIdsInRectRaw(rect, nodeRectIndex.getAll()),
    snapCandidates: () => snapIndex.getAll(),
    snapCandidatesInRect: (rect) => snapIndex.queryInRect(rect)
  }

  const applyPlan: ReadIndexRuntime['applyPlan'] = (plan, snapshot) => {
    if (plan.mode === 'none') return
    if (plan.mode === 'full') {
      syncIndex(snapshot.nodes.canvas)
      return
    }
    if (plan.mode === 'dirtyNodeIds' && plan.dirtyNodeIds.length) {
      syncIndexByNodeIds(plan.dirtyNodeIds, snapshot.indexes.canvasNodeById)
    }
  }

  return {
    query,
    applyPlan
  }
}
