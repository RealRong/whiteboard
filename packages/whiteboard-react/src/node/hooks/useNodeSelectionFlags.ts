import type { NodeId } from '@whiteboard/core'
import { useActiveTool, useInstanceAtomValue } from '../../common/hooks'
import { nodeGroupHoveredAtomFamily, nodeSelectedAtomFamily } from '../state/selectionFlagsAtom'

export const useNodeSelectionFlags = (nodeId: NodeId) => {
  const activeTool = useActiveTool()

  const selectedInSelectionSet = useInstanceAtomValue(nodeSelectedAtomFamily(nodeId))
  const hovered = useInstanceAtomValue(nodeGroupHoveredAtomFamily(nodeId))
  const selected = activeTool === 'edge' ? false : selectedInSelectionSet

  return {
    selected,
    hovered,
    activeTool
  }
}
