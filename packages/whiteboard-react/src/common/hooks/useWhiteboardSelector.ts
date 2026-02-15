import { useEffect, useMemo, useRef, useState } from 'react'
import { STATE_KEYS } from '@whiteboard/engine'
import type { StateKey, StateSnapshot } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Selector<T> = (snapshot: StateSnapshot) => T
type Equality<T> = (left: T, right: T) => boolean
type SelectorOptions<T> = {
  keys?: StateKey[]
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
  read: <K extends StateKey>(key: K) => StateSnapshot[K],
  keys: StateKey[]
): StateSnapshot => {
  const snapshot = {} as StateSnapshot
  const target = snapshot as Record<StateKey, StateSnapshot[StateKey]>
  keys.forEach((stateKey) => {
    target[stateKey] = read(stateKey) as StateSnapshot[StateKey]
  })
  return snapshot
}

export function useWhiteboardSelector<K extends StateKey>(key: K): StateSnapshot[K]
export function useWhiteboardSelector<T>(selector: Selector<T>, options?: SelectorOptions<T>): T

export function useWhiteboardSelector<T>(
  keyOrSelector: StateKey | Selector<T>,
  options?: SelectorOptions<T>
): T {
  const instance = useInstance()
  const isKeySelector = typeof keyOrSelector === 'string'
  const key = isKeySelector ? (keyOrSelector as StateKey) : undefined

  const selector: Selector<T> = isKeySelector
    ? ((snapshot) => snapshot[keyOrSelector] as T)
    : keyOrSelector

  const computedKeys = useMemo(
    () => normalizeKeys(isKeySelector ? [key as StateKey] : options?.keys ?? STATE_KEYS),
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

  const readSelected = () => {
    if (isKeySelector && key) {
      return instance.state.read(key) as T
    }
    const snapshot = readSnapshotByKeys(instance.state.read, keys)
    return selectorRef.current(snapshot)
  }

  const [selected, setSelected] = useState<T>(() => readSelected())

  useEffect(() => {
    const updateSelection = () => {
      const nextSelected = readSelected()
      setSelected((prev) => (equalityRef.current(prev, nextSelected) ? prev : nextSelected))
    }

    updateSelection()

    const unsubs = keys.map((stateKey) => instance.state.watch(stateKey, updateSelection))
    return () => {
      unsubs.forEach((off) => off())
    }
  }, [instance, isKeySelector, key, keys])

  return selected
}
