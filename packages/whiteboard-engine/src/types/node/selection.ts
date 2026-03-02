import type { EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { SelectionBoxState, SelectionMode } from '../state/model'

export type SelectionState = {
  tool: 'select' | 'edge'
  selectedEdgeId?: EdgeId
  selectedNodeIds: Set<NodeId>
  selectionBox: SelectionBoxState
  isSelected: (id: NodeId) => boolean
  hasSelection: () => boolean
}
