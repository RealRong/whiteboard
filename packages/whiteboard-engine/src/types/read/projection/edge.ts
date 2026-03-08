import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { EdgesView } from '../../instance/read'

export type EdgeReadProjection = {
  applyChange: (
    rebuild: 'none' | 'dirty' | 'full',
    nodeIds: readonly NodeId[],
    edgeIds: readonly EdgeId[]
  ) => void
  getView: () => EdgesView
}
