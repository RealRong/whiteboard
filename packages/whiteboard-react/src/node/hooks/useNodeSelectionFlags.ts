import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import type { NodeId } from '@whiteboard/core'
import { nodeSelectionAtom, toolAtom } from '../../common/state'
import { groupHoveredAtom } from '../state/groupRuntimeAtom'

export const useNodeSelectionFlags = (nodeId: NodeId) => {
  const tool = useAtomValue(toolAtom)

  const selectedAtom = useMemo(
    () => selectAtom(nodeSelectionAtom, (selection) => selection.selectedNodeIds.has(nodeId)),
    [nodeId]
  )
  const hoveredAtom = useMemo(
    () => selectAtom(groupHoveredAtom, (hoveredGroupId) => hoveredGroupId === nodeId),
    [nodeId]
  )

  const selectedInSelectionSet = useAtomValue(selectedAtom)
  const hovered = useAtomValue(hoveredAtom)
  const activeTool = (tool as 'select' | 'edge') ?? 'select'
  const selected = activeTool === 'edge' ? false : selectedInSelectionSet

  return {
    selected,
    hovered,
    activeTool
  }
}
