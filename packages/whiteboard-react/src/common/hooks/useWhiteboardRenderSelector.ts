import { useEffect, useMemo, useRef, useState } from 'react'
import type { RenderKey, RenderSnapshot } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Selector<T> = (snapshot: RenderSnapshot) => T
type Equality<T> = (left: T, right: T) => boolean
type SelectorOptions<T> = {
  keys: RenderKey[]
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

const isSameKeys = (left: RenderKey[], right: RenderKey[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const normalizeKeys = (keys: RenderKey[]) => Array.from(new Set(keys))

const readSnapshotByKeys = (
  read: <K extends RenderKey>(key: K) => RenderSnapshot[K],
  keys: RenderKey[]
): RenderSnapshot => {
  const snapshot = {} as RenderSnapshot
  const target = snapshot as Record<RenderKey, RenderSnapshot[RenderKey]>
  keys.forEach((stateKey) => {
    target[stateKey] = read(stateKey) as RenderSnapshot[RenderKey]
  })
  return snapshot
}

export function useWhiteboardRenderSelector<K extends RenderKey>(key: K): RenderSnapshot[K]
export function useWhiteboardRenderSelector<T>(selector: Selector<T>, options: SelectorOptions<T>): T

export function useWhiteboardRenderSelector<T>(
  keyOrSelector: RenderKey | Selector<T>,
  options?: SelectorOptions<T>
): T {
  const instance = useInstance()
  const isKeySelector = typeof keyOrSelector === 'string'
  const key = isKeySelector ? (keyOrSelector as RenderKey) : undefined

  if (!isKeySelector && (!options?.keys || options.keys.length === 0)) {
    throw new Error('useWhiteboardRenderSelector(selector) requires explicit keys')
  }

  const selector: Selector<T> = isKeySelector
    ? ((snapshot) => snapshot[keyOrSelector] as T)
    : keyOrSelector

  const computedKeys = useMemo(
    () => normalizeKeys(isKeySelector ? [key as RenderKey] : options!.keys),
    [isKeySelector, key, options?.keys]
  )

  const keysRef = useRef<RenderKey[]>(computedKeys)
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
      return instance.render.read(key) as T
    }
    const snapshot = readSnapshotByKeys(instance.render.read, keys)
    return selectorRef.current(snapshot)
  }

  const [selected, setSelected] = useState<T>(() => readSelected())

  useEffect(() => {
    const updateSelection = () => {
      const nextSelected = readSelected()
      setSelected((prev) => (equalityRef.current(prev, nextSelected) ? prev : nextSelected))
    }

    updateSelection()

    const unsubs = keys.map((stateKey) => instance.render.watch(stateKey, updateSelection))
    return () => {
      unsubs.forEach((off) => off())
    }
  }, [instance, isKeySelector, key, keys])

  return selected
}
