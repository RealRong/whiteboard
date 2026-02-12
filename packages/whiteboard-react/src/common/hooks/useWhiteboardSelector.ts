import { useEffect, useRef, useState } from 'react'
import {
  WHITEBOARD_STATE_KEYS,
  type WhiteboardStateKey,
  type WhiteboardStateSnapshot
} from '../../types/instance'
import { useInstance } from './useInstance'

type Selector<T> = (snapshot: WhiteboardStateSnapshot) => T
type Equality<T> = (left: T, right: T) => boolean
type SelectorOptions<T> = {
  keys?: WhiteboardStateKey[]
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

const isSameKeys = (left: WhiteboardStateKey[], right: WhiteboardStateKey[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export function useWhiteboardSelector<K extends WhiteboardStateKey>(key: K): WhiteboardStateSnapshot[K]
export function useWhiteboardSelector<T>(selector: Selector<T>, options?: SelectorOptions<T>): T

export function useWhiteboardSelector<T>(
  keyOrSelector: WhiteboardStateKey | Selector<T>,
  options?: SelectorOptions<T>
): T {
  const instance = useInstance()
  const isKeySelector = typeof keyOrSelector === 'string'
  const key = isKeySelector ? (keyOrSelector as WhiteboardStateKey) : undefined
  const selector: Selector<T> = isKeySelector
    ? ((snapshot) => snapshot[keyOrSelector] as T)
    : keyOrSelector

  const computedKeys = (isKeySelector
    ? [key as WhiteboardStateKey]
    : options?.keys ?? WHITEBOARD_STATE_KEYS) as WhiteboardStateKey[]
  const keysRef = useRef<WhiteboardStateKey[]>(computedKeys)
  if (!isSameKeys(keysRef.current, computedKeys)) {
    keysRef.current = computedKeys
  }
  const keys = keysRef.current

  const equality = (options?.equality ?? defaultEquality) as Equality<T>

  const selectorRef = useRef(selector)
  const equalityRef = useRef(equality)
  selectorRef.current = selector
  equalityRef.current = equality

  const [selected, setSelected] = useState<T>(() => selector(instance.state.snapshot()))

  useEffect(() => {
    const updateSelection = () => {
      const nextSelected = selectorRef.current(instance.state.snapshot())
      setSelected((prev) => (equalityRef.current(prev, nextSelected) ? prev : nextSelected))
    }

    updateSelection()

    const unsubs = keys.map((stateKey) => instance.state.watch(stateKey, updateSelection))
    return () => {
      unsubs.forEach((off) => off())
    }
  }, [instance, keys])

  return selected
}
