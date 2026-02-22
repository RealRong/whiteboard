export class EventCenter<M extends Record<string, unknown>> {
  private listeners = new Map<
    keyof M,
    Set<(payload: M[keyof M]) => void>
  >()

  on = <K extends keyof M>(
    type: K,
    listener: (payload: M[K]) => void
  ): (() => void) => {
    const bucket =
      (this.listeners.get(type) as Set<(payload: M[K]) => void> | undefined) ??
      new Set<(payload: M[K]) => void>()

    bucket.add(listener)
    this.listeners.set(type, bucket as Set<(payload: M[keyof M]) => void>)

    return () => this.off(type, listener)
  }

  off = <K extends keyof M>(
    type: K,
    listener: (payload: M[K]) => void
  ): void => {
    const bucket = this.listeners.get(type) as Set<(payload: M[K]) => void> | undefined
    if (!bucket) return

    bucket.delete(listener)
    if (bucket.size === 0) this.listeners.delete(type)
  }

  emit = <K extends keyof M>(type: K, payload: M[K]): void => {
    const bucket = this.listeners.get(type) as Set<(payload: M[K]) => void> | undefined
    if (!bucket || bucket.size === 0) return

    const listeners = [...bucket]
    for (const listener of listeners) listener(payload)
  }

  clear = (): void => {
    this.listeners.clear()
  }
}
