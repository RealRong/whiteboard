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
import { DEFAULT_TUNING } from '../../../config'
import { NodeRectIndex } from './NodeRectIndex'
import { SnapIndex } from './SnapIndex'
import type { ReadIndexChangePlan } from '../changePlan'

export type IndexRuntime = {
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

export const runtime = (
  config: InstanceConfig,
  initialCanvasNodes: Node[]
): IndexRuntime => {
  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(() =>
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )

  const syncIndex = (nodes: Node[]) => {
    nodeRectIndex.syncFull(nodes)
    snapIndex.syncFull(nodeRectIndex.all())
  }

  const syncIndexByNodeIds = (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ) => {
    const changed = nodeRectIndex.syncByNodeIds(nodeIds, nodeById)
    if (!changed) return
    snapIndex.syncByNodeIds(nodeIds, nodeRectIndex.byId)
  }

  syncIndex(initialCanvasNodes)

  const query: IndexRuntime['query'] = {
    nodeRects: () => nodeRectIndex.all(),
    nodeRect: (nodeId) => nodeRectIndex.byId(nodeId),
    nodeIdsInRect: (rect) => getNodeIdsInRectRaw(rect, nodeRectIndex.all()),
    snapCandidates: () => snapIndex.all(),
    snapCandidatesInRect: (rect) => snapIndex.queryInRect(rect)
  }

  const applyPlan: IndexRuntime['applyPlan'] = (plan, snapshot) => {
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
