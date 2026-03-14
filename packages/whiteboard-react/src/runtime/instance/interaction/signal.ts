import type { ValueView } from '../view'

type Signal<T> = ValueView<T> & {
  set: (next: T) => void
}

export const createSignal = <T,>(initial: T): Signal<T> => {
  let value = initial
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: (next) => {
      if (Object.is(value, next)) return
      value = next
      listeners.forEach((listener) => {
        listener()
      })
    }
  }
}
