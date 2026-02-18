export type Listener = () => void

export const isSameIdOrder = <TId extends string>(
  left: readonly TId[],
  right: readonly TId[]
) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const notifyListeners = (listeners?: Set<Listener>) => {
  if (!listeners?.size) return
  listeners.forEach((listener) => listener())
}

export const watchSet = (listeners: Set<Listener>, listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const watchEntity = <TId extends string>(
  map: Map<TId, Set<Listener>>,
  id: TId,
  listener: Listener
) => {
  const listeners = map.get(id) ?? new Set<Listener>()
  listeners.add(listener)
  map.set(id, listeners)
  return () => {
    const current = map.get(id)
    if (!current) return
    current.delete(listener)
    if (!current.size) {
      map.delete(id)
    }
  }
}
