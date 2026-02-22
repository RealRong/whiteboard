type Listener = () => void
type ChangeListener<TKey extends PropertyKey> = (key: TKey) => void

type Updater<T> = T | ((prev: T) => T)

const resolveNext = <T,>(next: Updater<T>, prev: T): T =>
  typeof next === 'function' ? (next as (value: T) => T)(prev) : next

export class WritableStore<TState extends Record<string, unknown>> {
  private state: TState
  private listeners = new Map<keyof TState, Set<Listener>>()
  private changeListeners = new Set<ChangeListener<keyof TState>>()
  private batchDepth = 0
  private frameBatchDepth = 0
  private pendingKeys = new Set<keyof TState>()
  private frameFlushScheduled = false

  constructor(initialState: TState) {
    this.state = initialState
  }

  get = <K extends keyof TState>(key: K): TState[K] => this.state[key]

  private notify = (key: keyof TState) => {
    const keyListeners = this.listeners.get(key)
    if (keyListeners?.size) {
      keyListeners.forEach((listener) => listener())
    }
    if (this.changeListeners.size) {
      this.changeListeners.forEach((listener) => listener(key))
    }
  }

  private flush = () => {
    if (!this.pendingKeys.size) return
    const keys = Array.from(this.pendingKeys)
    this.pendingKeys.clear()
    keys.forEach((key) => this.notify(key))
  }

  private scheduleFrameFlush = () => {
    if (this.frameFlushScheduled || !this.pendingKeys.size) return
    this.frameFlushScheduled = true

    const requestFrame = (globalThis as { requestAnimationFrame?: (callback: () => void) => number })
      .requestAnimationFrame
    if (typeof requestFrame === 'function') {
      requestFrame(() => {
        this.frameFlushScheduled = false
        this.flush()
      })
      return
    }

    setTimeout(() => {
      this.frameFlushScheduled = false
      this.flush()
    }, 16)
  }

  batch = (action: () => void) => {
    this.batchDepth += 1
    try {
      action()
    } finally {
      this.batchDepth -= 1
      if (this.batchDepth === 0) {
        if (this.frameBatchDepth > 0) {
          this.scheduleFrameFlush()
          return
        }
        this.flush()
      }
    }
  }

  batchFrame = (action: () => void) => {
    this.frameBatchDepth += 1
    try {
      this.batch(action)
    } finally {
      this.frameBatchDepth -= 1
      if (this.batchDepth === 0 && this.frameBatchDepth === 0) {
        this.scheduleFrameFlush()
      }
    }
  }

  set = <K extends keyof TState>(key: K, next: Updater<TState[K]>) => {
    const prev = this.state[key]
    const resolved = resolveNext(next, prev)
    if (Object.is(prev, resolved)) return

    this.state[key] = resolved
    if (this.batchDepth > 0 || this.frameBatchDepth > 0) {
      this.pendingKeys.add(key)
      if (this.batchDepth === 0) {
        this.scheduleFrameFlush()
      }
      return
    }
    this.notify(key)
  }

  watch = (key: keyof TState, listener: Listener) => {
    let keyListeners = this.listeners.get(key)
    if (!keyListeners) {
      keyListeners = new Set<Listener>()
      this.listeners.set(key, keyListeners)
    }
    keyListeners.add(listener)

    return () => {
      const current = this.listeners.get(key)
      if (!current) return
      current.delete(listener)
      if (!current.size) {
        this.listeners.delete(key)
      }
    }
  }

  watchChanges = (listener: ChangeListener<keyof TState>) => {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  snapshot = (): TState => ({ ...this.state })
}
