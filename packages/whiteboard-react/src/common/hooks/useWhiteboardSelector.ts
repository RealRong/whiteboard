import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { StateKey, StateSnapshot } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Selector<T> = (snapshot: StateSnapshot) => T
type Equality<T> = (left: T, right: T) => boolean
type SelectorOptions<T> = {
  keys: StateKey[]
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

const isSameKeys = (left: StateKey[], right: StateKey[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const normalizeKeys = (keys: StateKey[]) => Array.from(new Set(keys))

const readSnapshotByKeys = (
  getValueByKey: <K extends StateKey>(key: K) => StateSnapshot[K],
  keys: StateKey[]
): StateSnapshot => {
  const snapshot = {} as StateSnapshot
  const target = snapshot as Record<StateKey, StateSnapshot[StateKey]>
  keys.forEach((stateKey) => {
    target[stateKey] = getValueByKey(stateKey)
  })
  return snapshot
}

export function useWhiteboardSelector<K extends StateKey>(key: K): StateSnapshot[K]
export function useWhiteboardSelector<T>(selector: Selector<T>, options: SelectorOptions<T>): T

export function useWhiteboardSelector<T>(
  keyOrSelector: StateKey | Selector<T>,
  options?: SelectorOptions<T>
): T {
  const instance = useInstance()
  const isKeySelector = typeof keyOrSelector === 'string'
  const key = isKeySelector ? (keyOrSelector as StateKey) : undefined

  if (!isKeySelector && (!options?.keys || options.keys.length === 0)) {
    throw new Error('useWhiteboardSelector(selector) requires explicit keys')
  }

  const selector: Selector<T> = isKeySelector
    ? ((snapshot) => snapshot[keyOrSelector] as T)
    : keyOrSelector

  const computedKeys = useMemo(
    () => normalizeKeys(isKeySelector ? [key as StateKey] : options!.keys),
    [isKeySelector, key, options?.keys]
  )

  const keysRef = useRef<StateKey[]>(computedKeys)
  if (!isSameKeys(keysRef.current, computedKeys)) {
    keysRef.current = computedKeys
  }
  const keys = keysRef.current

  const selectorRef = useRef(selector)
  const equalityRef = useRef((options?.equality ?? defaultEquality) as Equality<T>)
  selectorRef.current = selector
  equalityRef.current = (options?.equality ?? defaultEquality) as Equality<T>
  const cacheRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as T
  })

  const subscribe = useMemo(
    () => (onStoreChange: () => void) => instance.read.subscribe(keys, onStoreChange),
    [instance, keys]
  )

  const getSnapshot = useMemo(
    () => () => {
      const snapshot = readSnapshotByKeys(
        instance.state.read,
        keys
      )
      const next = selectorRef.current(snapshot)
      if (
        cacheRef.current.hasValue
        && equalityRef.current(cacheRef.current.value, next)
      ) {
        return cacheRef.current.value
      }
      cacheRef.current = {
        hasValue: true,
        value: next
      }
      return next
    },
    [instance, keys]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
