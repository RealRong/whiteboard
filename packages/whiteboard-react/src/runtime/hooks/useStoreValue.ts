import { useMemo, useRef, useSyncExternalStore } from 'react'
import type {
  KeyedReadStore,
  ReadStore
} from '@whiteboard/core/runtime'

export const useStoreValue = <T,>(
  store: ReadStore<T>
): T => {
  const snapshotRef = useRef<T | undefined>(undefined)

  const getSnapshot = useMemo(
    () => () => {
      const next = store.get()
      const cached = snapshotRef.current

      if (cached !== undefined && Object.is(cached, next)) {
        return cached
      }

      snapshotRef.current = next
      return next
    },
    [store]
  )

  return useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getSnapshot
  )
}

export const useKeyedStoreValue = <Key, T,>(
  store: KeyedReadStore<Key, T>,
  key: Key
): T => {
  const snapshotRef = useRef<T | undefined>(undefined)

  const subscribe = useMemo(
    () => (listener: () => void) => store.subscribe(key, listener),
    [key, store]
  )

  const getSnapshot = useMemo(
    () => () => {
      const next = store.get(key)
      const cached = snapshotRef.current

      if (cached !== undefined && Object.is(cached, next)) {
        return cached
      }

      snapshotRef.current = next
      return next
    },
    [key, store]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )
}
