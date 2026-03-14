import { useSyncExternalStore } from 'react'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { useInternalInstance } from '../hooks'

export const useSelectionContains = (nodeId: NodeId): boolean => {
  const instance = useInternalInstance()
  return useSyncExternalStore(
    (listener) => instance.state.selection.subscribeNode(nodeId, listener),
    () => instance.state.selection.contains(nodeId),
    () => instance.state.selection.contains(nodeId)
  )
}

export const useSelectedEdgeId = (): EdgeId | undefined => {
  const instance = useInternalInstance()
  return useSyncExternalStore(
    instance.state.selection.subscribeEdge,
    instance.state.selection.getEdgeId,
    instance.state.selection.getEdgeId
  )
}
