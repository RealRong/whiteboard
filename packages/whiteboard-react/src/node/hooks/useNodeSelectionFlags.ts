import type { NodeId } from '@whiteboard/core'
import { useActiveTool, useWhiteboardSelector } from '../../common/hooks'

export const useNodeSelectionFlags = (nodeId: NodeId) => {
  const activeTool = useActiveTool()

  const selectedInSelectionSet = useWhiteboardSelector((state) => state.selection.selectedNodeIds.has(nodeId))
  const hovered = useWhiteboardSelector((state) => state.groupHovered === nodeId)
  const selected = activeTool === 'edge' ? false : selectedInSelectionSet

  return {
    selected,
    hovered,
    activeTool
  }
}
