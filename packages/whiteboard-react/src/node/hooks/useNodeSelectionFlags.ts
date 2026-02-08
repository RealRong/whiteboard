import { useMemo } from 'react'
import { selectAtom } from 'jotai/utils'
import type { NodeId } from '@whiteboard/core'
import { nodeSelectionAtom } from '../../common/state'
import { groupHoveredAtom } from '../state/groupRuntimeAtom'
import { useActiveTool, useInstanceAtomValue } from '../../common/hooks'

export const useNodeSelectionFlags = (nodeId: NodeId) => {
  const activeTool = useActiveTool()

  const selectedAtom = useMemo(
    () => selectAtom(nodeSelectionAtom, (selection) => selection.selectedNodeIds.has(nodeId)),
    [nodeId]
  )
  const hoveredAtom = useMemo(
    () => selectAtom(groupHoveredAtom, (hoveredGroupId) => hoveredGroupId === nodeId),
    [nodeId]
  )

  const selectedInSelectionSet = useInstanceAtomValue(selectedAtom)
  const hovered = useInstanceAtomValue(hoveredAtom)
  const selected = activeTool === 'edge' ? false : selectedInSelectionSet

  return {
    selected,
    hovered,
    activeTool
  }
}
