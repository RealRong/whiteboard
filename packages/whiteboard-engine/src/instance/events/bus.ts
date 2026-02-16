import type {
  InstanceEventEmitter,
  InstanceEventMap
} from '@engine-types/instance/events'

export const createEventBus = (): InstanceEventEmitter => {
  const listenerMap = new Map<
    keyof InstanceEventMap,
    Set<(payload: InstanceEventMap[keyof InstanceEventMap]) => void>
  >()

  const on: InstanceEventEmitter['on'] = (type, listener) => {
    const listeners = listenerMap.get(type) ?? new Set()
    listeners.add(listener as (payload: InstanceEventMap[keyof InstanceEventMap]) => void)
    listenerMap.set(type, listeners)
    return () => {
      off(type, listener)
    }
  }

  const off: InstanceEventEmitter['off'] = (type, listener) => {
    const listeners = listenerMap.get(type)
    if (!listeners) return
    listeners.delete(listener as (payload: InstanceEventMap[keyof InstanceEventMap]) => void)
    if (listeners.size === 0) {
      listenerMap.delete(type)
    }
  }

  const emit: InstanceEventEmitter['emit'] = (type, payload) => {
    const listeners = listenerMap.get(type)
    if (!listeners || listeners.size === 0) return
    listeners.forEach((listener) => {
      listener(payload)
    })
  }

  return {
    on,
    off,
    emit
  }
}
