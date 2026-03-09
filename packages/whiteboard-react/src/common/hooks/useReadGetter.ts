import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { ReadSubscriptionKey } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Equality<T> = (left: T, right: T) => boolean

type ReadGetterOptions<T> = {
  key: ReadSubscriptionKey
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

export const useReadGetter = <T,>(
  getter: () => T,
  options: ReadGetterOptions<T>
): T => {
  const instance = useInstance()
  const key = options.key

  const getterRef = useRef(getter)
  getterRef.current = getter
  const equalityRef = useRef((options.equality ?? defaultEquality) as Equality<T>)
  equalityRef.current = (options.equality ?? defaultEquality) as Equality<T>
  const cacheRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as T
  })

  const subscribe = useMemo(
    () => (onStoreChange: () => void) => instance.read.subscribe(key, onStoreChange),
    [instance, key]
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
    [instance, key]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
