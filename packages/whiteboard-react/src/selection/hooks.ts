import { useMemo } from 'react'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import {
  createSelectionContainsAtom,
  selectedEdgeIdAtom
} from './domain'

export const useSelectionContains = (nodeId: NodeId): boolean => {
  const targetAtom = useMemo(
    () => createSelectionContainsAtom(nodeId),
    [nodeId]
  )
  return useUiAtomValue(targetAtom)
}

export const useSelectedEdgeId = (): EdgeId | undefined => useUiAtomValue(selectedEdgeIdAtom)
