import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'

type Signal<T> = ValueStore<T>

export const createSignal = <T,>(initial: T): Signal<T> => createValueStore(initial)
