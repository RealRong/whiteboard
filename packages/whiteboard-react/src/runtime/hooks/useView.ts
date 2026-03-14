import { useMemo, useRef, useSyncExternalStore } from 'react'
import type {
  KeyedView,
  ParameterizedView,
  ValueView
} from '../instance/view'

export const useView = <T,>(
  view: ValueView<T>
): T => {
  const snapshotRef = useRef<T | undefined>(undefined)

  const getSnapshot = useMemo(
    () => () => {
      const next = view.get()
      const cached = snapshotRef.current

      if (
        cached !== undefined
        && (view.isEqual ? view.isEqual(cached, next) : Object.is(cached, next))
      ) {
        return cached
      }

      snapshotRef.current = next
      return next
    },
    [view]
  )

  return useSyncExternalStore(
    view.subscribe,
    getSnapshot,
    getSnapshot
  )
}

export const useViewArgs = <Args, T>(
  view: ParameterizedView<Args, T>,
  args: Args
): T => {
  const snapshotRef = useRef<T | undefined>(undefined)

  const getSnapshot = useMemo(
    () => () => {
      const next = view.get(args)
      const cached = snapshotRef.current

      if (
        cached !== undefined
        && (view.isEqual ? view.isEqual(cached, next) : Object.is(cached, next))
      ) {
        return cached
      }

      snapshotRef.current = next
      return next
    },
    [args, view]
  )

  return useSyncExternalStore(
    view.subscribe,
    getSnapshot,
    getSnapshot
  )
}

export const useKeyedView = <Key, T, Args = undefined>(
  view: KeyedView<Key, T, Args>,
  key: Key
): T => {
  const snapshotRef = useRef<T | undefined>(undefined)

  const subscribe = useMemo(
    () => (listener: () => void) => view.subscribe(key, listener),
    [key, view]
  )

  const getSnapshot = useMemo(
    () => () => {
      const next = view.get(key)
      const cached = snapshotRef.current

      if (
        cached !== undefined
        && (view.isEqual ? view.isEqual(cached, next) : Object.is(cached, next))
      ) {
        return cached
      }

      snapshotRef.current = next
      return next
    },
    [key, view]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )
}

export const useKeyedViewArgs = <Key, Args, T>(
  view: KeyedView<Key, T, Args>,
  key: Key,
  args: Args
): T => {
  const snapshotRef = useRef<T | undefined>(undefined)

  const subscribe = useMemo(
    () => (listener: () => void) => view.subscribe(key, listener),
    [key, view]
  )

  const getSnapshot = useMemo(
    () => () => {
      const next = view.get(key, args)
      const cached = snapshotRef.current

      if (
        cached !== undefined
        && (view.isEqual ? view.isEqual(cached, next) : Object.is(cached, next))
      ) {
        return cached
      }

      snapshotRef.current = next
      return next
    },
    [args, key, view]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  )
}
