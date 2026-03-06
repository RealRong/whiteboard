import type { InstanceConfig } from '@engine-types/instance/config'
import type { Indexer } from '@engine-types/read/indexer'
import type { ReadModelSnapshot } from '@engine-types/read/snapshot'
import { DEFAULT_TUNING } from '../../../../config'
import { NodeRectIndex } from './NodeRectIndex'
import { SnapIndex } from './SnapIndex'

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

  const applyChange: Indexer['applyChange'] = (change) => {
    if (change.rebuild === 'none') return
    const snapshot = readSnapshot()
    const changed = nodeRectIndex.applyChange(change, snapshot)
    if (!changed) return
    snapIndex.applyChange(change, nodeRectIndex)
  }

  applyChange({ rebuild: 'full', nodeIds: [] })

  return {
    query: {
      canvas: {
        all: nodeRectIndex.all,
        byId: nodeRectIndex.byId,
        idsInRect: nodeRectIndex.nodeIdsInRect
      },
      snap: {
        all: snapIndex.all,
        inRect: snapIndex.queryInRect
      }
    },
    applyChange
  }
}
