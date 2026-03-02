import type { InstanceConfig } from '@engine-types/instance/config'
import type { ReadModelSnapshot } from '@engine-types/read/snapshot'
import { DEFAULT_TUNING } from '../../../config'
import { NodeRectIndex } from './NodeRectIndex'
import { SnapIndex } from './SnapIndex'
import type { IndexApplySource, Indexer } from '@engine-types/read/indexer'

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
    if (plan.mode === 'none') return
    const snapshot = readSnapshot()
    const source: IndexApplySource = {
      snapshot,
      canvas: nodeRectIndex
    }
    const changed = nodeRectIndex.applyPlan(plan, source)
    if (!changed) return
    snapIndex.applyPlan(plan, source)
  }

  applyPlan({ mode: 'full', dirtyNodeIds: [] })

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
