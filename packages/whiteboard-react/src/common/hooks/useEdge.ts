import { useMemo, useSyncExternalStore } from 'react'
import type { EdgeId } from '@whiteboard/core/types'
import type { EdgeEntry } from '@whiteboard/engine'
import { useInstance } from './useInstance'

const EMPTY_EDGE_IDS: readonly EdgeId[] = []

export const useEdgeIds = (): readonly EdgeId[] => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.read.edge.subscribeIds(listener),
    [instance]
  )

  const getSnapshot = useMemo(
    () => () => instance.read.edge.ids(),
    [instance]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_EDGE_IDS)
}

export const useEdge = (
  edgeId: EdgeId | undefined
): EdgeEntry | undefined => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => {
      if (!edgeId) {
        return () => {}
      }
      return instance.read.edge.subscribe(edgeId, listener)
    },
    [instance, edgeId]
  )

  const getSnapshot = useMemo(
    () => () => {
      if (!edgeId) return undefined
      return instance.read.edge.get(edgeId)
    },
    [instance, edgeId]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}
