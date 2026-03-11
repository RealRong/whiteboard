import type { createStore } from 'jotai/vanilla'

type UiStore = ReturnType<typeof createStore>
type SignalListener = () => void

const transientResetListeners = new WeakMap<object, Set<SignalListener>>()

const subscribe = (
  listenersByStore: WeakMap<object, Set<SignalListener>>,
  uiStore: UiStore,
  listener: SignalListener
) => {
  let listeners = listenersByStore.get(uiStore)
  if (!listeners) {
    listeners = new Set<SignalListener>()
    listenersByStore.set(uiStore, listeners)
  }
  listeners.add(listener)

  return () => {
    const current = listenersByStore.get(uiStore)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) {
      listenersByStore.delete(uiStore)
    }
  }
}

const emit = (
  listenersByStore: WeakMap<object, Set<SignalListener>>,
  uiStore: UiStore
) => {
  const listeners = listenersByStore.get(uiStore)
  if (!listeners) return
  listeners.forEach((listener) => {
    listener()
  })
}

export const uiSignals = {
  transientReset: {
    subscribe: (uiStore: UiStore, listener: SignalListener) =>
      subscribe(transientResetListeners, uiStore, listener),
    emit: (uiStore: UiStore) => {
      emit(transientResetListeners, uiStore)
    }
  }
}
