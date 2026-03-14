import { useMemo, useSyncExternalStore } from 'react'

type Listener = () => void

type ValueReader<Value> = {
  get: () => Value
  subscribe: (listener: Listener) => () => void
}

type CreateValueDraftStoreOptions<Value> = {
  schedule: () => void
  initialValue: Value
  isEqual: (left: Value, right: Value) => boolean
}

const NO_PENDING = Symbol('no-pending')
const CLEAR_PENDING = Symbol('clear-pending')

export const createValueDraftStore = <Value>({
  schedule,
  initialValue,
  isEqual
}: CreateValueDraftStoreOptions<Value>) => {
  let current = initialValue
  let pending: Value | typeof NO_PENDING | typeof CLEAR_PENDING = NO_PENDING
  const listeners = new Set<Listener>()

  const notify = () => {
    listeners.forEach((listener) => {
      listener()
    })
  }

  return {
    get: () => current,
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    write: (next: Value) => {
      pending = next
      schedule()
    },
    clear: () => {
      pending = CLEAR_PENDING
      if (isEqual(current, initialValue)) return
      current = initialValue
      notify()
    },
    flush: () => {
      if (pending === NO_PENDING) return
      const next =
        pending === CLEAR_PENDING
          ? initialValue
          : pending
      pending = NO_PENDING
      if (isEqual(current, next)) {
        return
      }
      current = next
      notify()
    }
  }
}

export const useValueDraft = <Value>(
  reader: ValueReader<Value>,
  getServerSnapshot: () => Value
) => {
  const subscribe = useMemo(
    () => reader.subscribe,
    [reader]
  )
  const getSnapshot = useMemo(
    () => reader.get,
    [reader]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
}
