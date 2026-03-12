import { useEffect } from 'react'
import type { createStore } from 'jotai/vanilla'
import type { InternalWhiteboardInstance } from '../instance/types'
import { useInternalInstance } from './useInstance'

type UiStore = ReturnType<typeof createStore>
type TransientResetListener = () => void

const transientResetListeners = new WeakMap<object, Set<TransientResetListener>>()

const subscribeTransientReset = (
  uiStore: UiStore,
  listener: TransientResetListener
) => {
  let listeners = transientResetListeners.get(uiStore)
  if (!listeners) {
    listeners = new Set<TransientResetListener>()
    transientResetListeners.set(uiStore, listeners)
  }
  listeners.add(listener)

  return () => {
    const current = transientResetListeners.get(uiStore)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) {
      transientResetListeners.delete(uiStore)
    }
  }
}

export const resetTransient = (
  instance: Pick<InternalWhiteboardInstance, 'uiStore'>
) => {
  const listeners = transientResetListeners.get(instance.uiStore)
  if (!listeners) return
  listeners.forEach((listener) => {
    listener()
  })
}

export const useTransientReset = (handler: () => void) => {
  const instance = useInternalInstance()

  useEffect(() => {
    const unsubscribe = subscribeTransientReset(instance.uiStore, handler)

    return () => {
      unsubscribe()
      handler()
    }
  }, [handler, instance.uiStore])
}
