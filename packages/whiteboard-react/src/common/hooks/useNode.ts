import { useMemo, useSyncExternalStore } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import { useInstance } from './useInstance'

const EMPTY_NODE_IDS: readonly NodeId[] = []

export const useNodeIds = (): readonly NodeId[] => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.read.node.subscribeIds(listener),
    [instance]
  )

  const getSnapshot = useMemo(
    () => () => instance.read.node.ids(),
    [instance]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_NODE_IDS)
}

export const useNode = (
  nodeId: NodeId | undefined
): NodeViewItem | undefined => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => {
      if (!nodeId) {
        return () => {}
      }
      return instance.read.node.subscribe(nodeId, listener)
    },
    [instance, nodeId]
  )

  const getSnapshot = useMemo(
    () => () => {
      if (!nodeId) return undefined
      return instance.read.node.get(nodeId)
    },
    [instance, nodeId]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}
