import type { Bus as ChangeBus, Change } from '@engine-types/write/change'

export const bus = (): ChangeBus => {
  const listeners = new Set<(change: Change) => void>()

  return {
    publish: (change) => {
      if (!listeners.size) return
      listeners.forEach((listener) => {
        listener(change)
      })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
