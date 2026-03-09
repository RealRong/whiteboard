import { useMemo, useSyncExternalStore } from 'react'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { useInstance } from './useInstance'

export const useSelectionContains = (nodeId: NodeId): boolean => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.state.selection.subscribeNode(nodeId, listener),
    [instance, nodeId]
  )

  const getSnapshot = useMemo(
    () => () => instance.state.selection.contains(nodeId),
    [instance, nodeId]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export const useSelectedEdgeId = (): EdgeId | undefined => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.state.selection.subscribeEdge(listener),
    [instance]
  )

  const getSnapshot = useMemo(
    () => () => instance.state.selection.selectedEdgeId(),
    [instance]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}
