import { useEffect, useMemo, useRef, useState } from 'react'
import {
  WHITEBOARD_STATE_KEYS,
  type WhiteboardStateKey,
  type WhiteboardStateSnapshot
} from 'types/instance'
import { useInstance } from './useInstance'

type Selector<T> = (snapshot: WhiteboardStateSnapshot) => T
type Equality<T> = (left: T, right: T) => boolean
type SelectorOptions<T> = {
  keys?: WhiteboardStateKey[]
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

export function useWhiteboardSelector<K extends WhiteboardStateKey>(key: K): WhiteboardStateSnapshot[K]
export function useWhiteboardSelector<T>(selector: Selector<T>, options?: SelectorOptions<T>): T

export function useWhiteboardSelector<T>(
  keyOrSelector: WhiteboardStateKey | Selector<T>,
  options?: SelectorOptions<T>
): T {
  const instance = useInstance()
  const isKeySelector = typeof keyOrSelector === 'string'
  const selector: Selector<T> = isKeySelector
    ? ((snapshot) => snapshot[keyOrSelector] as T)
    : keyOrSelector
  const keys = useMemo(
    () =>
      isKeySelector
        ? [keyOrSelector as WhiteboardStateKey]
        : options?.keys ?? [...WHITEBOARD_STATE_KEYS],
    [isKeySelector, keyOrSelector, options?.keys]
  )
  const equality = (options?.equality ?? defaultEquality) as Equality<T>

  const selectorRef = useRef(selector)
  const equalityRef = useRef(equality)
  selectorRef.current = selector
  equalityRef.current = equality

  const [selected, setSelected] = useState<T>(() => selector(instance.state.snapshot()))

  useEffect(() => {
    const nextSelected = selector(instance.state.snapshot())
    setSelected((prev) => (equalityRef.current(prev, nextSelected) ? prev : nextSelected))
  }, [instance, selector, equality])

  useEffect(() => {
    const updateSelection = () => {
      const nextSelected = selectorRef.current(instance.state.snapshot())
      setSelected((prev) => (equalityRef.current(prev, nextSelected) ? prev : nextSelected))
    }
    const unsubs = keys.map((key) => instance.state.watch(key, updateSelection))
    return () => {
      unsubs.forEach((off) => off())
    }
  }, [instance, keys])

  return selected
}
