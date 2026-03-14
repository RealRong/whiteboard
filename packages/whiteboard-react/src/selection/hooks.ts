import { useMemo } from 'react'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import {
  createSelectionContainsAtom,
  selectionAtom,
  selectedNodeIdsAtom,
  selectedEdgeIdAtom
} from './domain'
import type { Selection } from './domain'

export const useSelectionContains = (nodeId: NodeId): boolean => {
  const targetAtom = useMemo(
    () => createSelectionContainsAtom(nodeId),
    [nodeId]
  )
  return useUiAtomValue(targetAtom)
}

export const useSelection = (): Selection => useUiAtomValue(selectionAtom)
export const useSelectedNodeIds = (): readonly NodeId[] => useUiAtomValue(selectedNodeIdsAtom)
export const useSelectedEdgeId = (): EdgeId | undefined => useUiAtomValue(selectedEdgeIdAtom)
