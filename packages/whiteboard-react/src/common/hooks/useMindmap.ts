import { useMemo, useSyncExternalStore } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { MindmapViewTree } from '@whiteboard/engine'
import { useInstance } from './useInstance'

const EMPTY_TREE_IDS: readonly NodeId[] = []

export const useMindmapIds = (): readonly NodeId[] => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.read.mindmap.subscribeIds(listener),
    [instance]
  )

  const getSnapshot = useMemo(
    () => () => instance.read.mindmap.ids(),
    [instance]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_TREE_IDS)
}

export const useMindmap = (
  treeId: NodeId | undefined
): MindmapViewTree | undefined => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => {
      if (!treeId) {
        return () => {}
      }
      return instance.read.mindmap.subscribe(treeId, listener)
    },
    [instance, treeId]
  )

  const getSnapshot = useMemo(
    () => () => {
      if (!treeId) return undefined
      return instance.read.mindmap.get(treeId)
    },
    [instance, treeId]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}
