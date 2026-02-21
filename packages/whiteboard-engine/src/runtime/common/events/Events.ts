export class Events<M extends Record<string, unknown>> {
  private listeners = new Map<
    keyof M,
    Set<(payload: M[keyof M]) => void>
  >()

  on = <K extends keyof M>(
    type: K,
    listener: (payload: M[K]) => void
  ): (() => void) => {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener as (payload: M[keyof M]) => void)
    this.listeners.set(type, listeners)
    return () => {
      this.off(type, listener)
    }
  }

  off = <K extends keyof M>(
    type: K,
    listener: (payload: M[K]) => void
  ) => {
    const listeners = this.listeners.get(type)
    if (!listeners) return

    listeners.delete(listener as (payload: M[keyof M]) => void)
    if (listeners.size === 0) {
      this.listeners.delete(type)
    }
  }

  emit = <K extends keyof M>(type: K, payload: M[K]) => {
    const listeners = this.listeners.get(type)
    if (!listeners || listeners.size === 0) return
    listeners.forEach((listener) => {
      listener(payload)
    })
  }

  clear = () => {
    this.listeners.clear()
  }
}
