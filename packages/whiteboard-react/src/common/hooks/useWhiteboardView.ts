import { useEffect, useRef, useState } from 'react'
import type { ViewKey, ViewSnapshot } from '@whiteboard/engine'
import { useInstance } from './useInstance'

type Equality<T> = (left: T, right: T) => boolean

type UseWhiteboardViewOptions<T> = {
  equality?: Equality<T>
}

const defaultEquality: Equality<unknown> = Object.is

export const useWhiteboardView = <K extends ViewKey>(
  key: K,
  options?: UseWhiteboardViewOptions<ViewSnapshot[K]>
) => {
  const instance = useInstance()
  const equalityRef = useRef((options?.equality ?? defaultEquality) as Equality<ViewSnapshot[K]>)
  equalityRef.current = (options?.equality ?? defaultEquality) as Equality<ViewSnapshot[K]>

  const readValue = () => instance.view.read(key)
  const [value, setValue] = useState<ViewSnapshot[K]>(() => readValue())

  useEffect(() => {
    const update = () => {
      const next = readValue()
      setValue((prev) => (equalityRef.current(prev, next) ? prev : next))
    }

    update()
    return instance.view.watch(key, update)
  }, [instance, key])

  return value
}
