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
