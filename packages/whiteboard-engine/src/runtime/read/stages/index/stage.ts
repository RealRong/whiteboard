import type { InstanceConfig } from '@engine-types/instance/config'
import type { ReadModelSnapshot } from '@engine-types/read/snapshot'
import { DEFAULT_TUNING } from '../../../../config'
import { NodeRectIndex } from './NodeRectIndex'
import { SnapIndex } from './SnapIndex'
import type { Indexer } from '@engine-types/read/indexer'

export const indexer = (
  config: InstanceConfig,
  readSnapshot: () => ReadModelSnapshot
): Indexer => {
  const nodeRectIndex = new NodeRectIndex(config)
  const cellSize = Math.max(
    config.node.snapGridCellSize,
    config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
  )
  const snapIndex = new SnapIndex(cellSize)

  const applyPlan: Indexer['applyPlan'] = (plan) => {
    if (plan.rebuild === 'none') return
    const snapshot = readSnapshot()
    const changed = nodeRectIndex.applyPlan(plan, snapshot)
    if (!changed) return
    snapIndex.applyPlan(plan, nodeRectIndex)
  }

  applyPlan({ rebuild: 'full', dirtyNodeIds: [] })

  const query: Indexer['query'] = {
    canvas: {
      all: nodeRectIndex.all,
      byId: nodeRectIndex.byId,
      idsInRect: nodeRectIndex.nodeIdsInRect
    },
    snap: {
      all: snapIndex.all,
      inRect: snapIndex.queryInRect
    }
  }

  return {
    query,
    applyPlan
  }
}
