import type { NodeId } from '@whiteboard/core'
import { useWhiteboardSelector } from '../../common/hooks'

export const useNodeSelectionFlags = (nodeId: NodeId) => {
  return useWhiteboardSelector(
    (snapshot) => {
      const activeTool = (snapshot.tool as 'select' | 'edge') ?? 'select'
      const selectedInSelectionSet = snapshot.selection.selectedNodeIds.has(nodeId)

      return {
        activeTool,
        selected: activeTool === 'edge' ? false : selectedInSelectionSet,
        hovered: snapshot.groupHovered === nodeId
      }
    },
    {
      keys: ['tool', 'selection', 'groupHovered'],
      equality: (left, right) =>
        left.activeTool === right.activeTool && left.selected === right.selected && left.hovered === right.hovered
    }
  )
}
