import { useMemo, useSyncExternalStore } from 'react'

type Listener = () => void

type KeyedReader<Key, Value> = {
  get: (key: Key) => Value
  subscribe: (key: Key, listener: Listener) => () => void
}

type CreateKeyedDraftStoreOptions<Key, Value, Input> = {
  schedule: () => void
  emptyState: ReadonlyMap<Key, Value>
  emptyValue: Value
  build: (input: Input) => ReadonlyMap<Key, Value>
  isEqual: (left: Value, right: Value) => boolean
}

export const createKeyedDraftStore = <Key, Value, Input>({
  schedule,
  emptyState,
  emptyValue,
  build,
  isEqual
}: CreateKeyedDraftStoreOptions<Key, Value, Input>) => {
  let current = emptyState
  let pending: Input | undefined
  const listenersByKey = new Map<Key, Set<Listener>>()

  const notify = (key: Key) => {
    const listeners = listenersByKey.get(key)
    if (!listeners?.size) return
    listeners.forEach((listener) => {
      listener()
    })
  }

  const commit = (next: ReadonlyMap<Key, Value>) => {
    const prev = current
    if (prev === next) return

    current = next

    const changedKeys = new Set<Key>()
    prev.forEach((_, key) => {
      changedKeys.add(key)
    })
    next.forEach((_, key) => {
      changedKeys.add(key)
    })

    changedKeys.forEach((key) => {
      const prevValue = prev.get(key) ?? emptyValue
      const nextValue = next.get(key) ?? emptyValue
      if (isEqual(prevValue, nextValue)) {
        return
      }
      notify(key)
    })
  }

  return {
    get: (key: Key) => current.get(key) ?? emptyValue,
    subscribe: (key: Key, listener: Listener) => {
      let listeners = listenersByKey.get(key)
      if (!listeners) {
        listeners = new Set<Listener>()
        listenersByKey.set(key, listeners)
      }
      listeners.add(listener)

      return () => {
        const currentListeners = listenersByKey.get(key)
        if (!currentListeners) return
        currentListeners.delete(listener)
        if (!currentListeners.size) {
          listenersByKey.delete(key)
        }
      }
    },
    write: (next: Input) => {
      pending = next
      schedule()
    },
    clear: () => {
      pending = undefined
      if (current === emptyState) return
      commit(emptyState)
    },
    flush: () => {
      if (pending === undefined) return
      const next = pending
      pending = undefined
      commit(build(next))
    }
  }
}

export const useKeyedDraft = <Key, Value>(
  reader: KeyedReader<Key, Value>,
  key: Key | undefined,
  emptyValue: Value
) => {
  const subscribe = useMemo(
    () => (listener: Listener) => {
      if (key === undefined) return () => {}
      return reader.subscribe(key, listener)
    },
    [reader, key]
  )
  const getSnapshot = useMemo(
    () => () => {
      if (key === undefined) return emptyValue
      return reader.get(key)
    },
    [reader, key, emptyValue]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => emptyValue
  )
}
