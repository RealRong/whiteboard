export type ReadStore<T> = {
  get: () => T
  subscribe: (listener: () => void) => () => void
}

export type KeyedReadStore<Key, T> = {
  get: (key: Key) => T
  subscribe: (key: Key, listener: () => void) => () => void
}

export type ValueStore<T> = ReadStore<T> & {
  set: (next: T) => void
  update: (recipe: (prev: T) => T) => void
}

export type ReadFn = {
  <T>(store: ReadStore<T>): T
  <Key, T>(store: KeyedReadStore<Key, T>, key: Key): T
}
