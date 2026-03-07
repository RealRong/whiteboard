import type { ReadControl, ReadSignals } from '@engine-types/read/change'
import type { EdgeReadCache } from '@engine-types/read/edge'
import type { ReadModel } from '@engine-types/read/model'
import { NodeRectIndex } from './stages/index/NodeRectIndex'
import { SnapIndex } from './stages/index/SnapIndex'

export const createReadApply = ({
  readModel,
  nodeRectIndex,
  snapIndex,
  edgeCache,
  applySignals
}: {
  readModel: () => ReadModel
  nodeRectIndex: NodeRectIndex
  snapIndex: SnapIndex
  edgeCache: EdgeReadCache
  applySignals: (signals: ReadSignals) => void
}) => (control: ReadControl) => {
  if (control.index.rebuild !== 'none') {
    const changed = nodeRectIndex.applyChange(control.index, readModel())
    if (changed) {
      snapIndex.applyChange(control.index, nodeRectIndex)
    }
  }

  edgeCache.applyChange(control.edge)

  applySignals(control.signals)
}
