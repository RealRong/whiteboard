export const subscribeListener = (
  listeners: Set<() => void>,
  listener: () => void
) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const notifyListeners = (listeners: ReadonlySet<() => void>) => {
  listeners.forEach((listener) => {
    listener()
  })
}
