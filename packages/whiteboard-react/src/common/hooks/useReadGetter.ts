import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { ReadSubscribeKey } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Equality<T> = (left: T, right: T) => boolean

type ReadGetterOptions<T> = {
  keys: ReadSubscribeKey[]
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

const normalizeKeys = (keys: ReadSubscribeKey[]) => Array.from(new Set(keys))

const isSameKeys = (left: ReadSubscribeKey[], right: ReadSubscribeKey[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const useReadGetter = <T,>(
  getter: () => T,
  options: ReadGetterOptions<T>
): T => {
  const instance = useInstance()
  if (!options.keys.length) {
    throw new Error('useReadGetter requires explicit keys')
  }

  const computedKeys = useMemo(
    () => normalizeKeys(options.keys),
    [options.keys]
  )

  const keysRef = useRef<ReadSubscribeKey[]>(computedKeys)
  if (!isSameKeys(keysRef.current, computedKeys)) {
    keysRef.current = computedKeys
  }
  const keys = keysRef.current

  const getterRef = useRef(getter)
  getterRef.current = getter
  const equalityRef = useRef((options.equality ?? defaultEquality) as Equality<T>)
  equalityRef.current = (options.equality ?? defaultEquality) as Equality<T>
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
      const next = getterRef.current()
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
