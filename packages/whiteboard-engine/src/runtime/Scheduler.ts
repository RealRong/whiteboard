export class Scheduler {
  private fallbackRafId = 0
  private fallbackRafTimers = new Map<number, ReturnType<typeof setTimeout>>()
  private nativeRafIds = new Set<number>()

  now = (): number => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now()
    }
    return Date.now()
  }

  microtask = (callback: () => void): void => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(callback)
      return
    }
    void Promise.resolve().then(callback)
  }

  raf = (callback: FrameRequestCallback): number => {
    if (typeof requestAnimationFrame === 'function') {
      const id = requestAnimationFrame((timestamp) => {
        this.nativeRafIds.delete(id)
        callback(timestamp)
      })
      this.nativeRafIds.add(id)
      return id
    }

    const id = ++this.fallbackRafId
    const timer = setTimeout(() => {
      this.fallbackRafTimers.delete(id)
      callback(this.now())
    }, 16)
    this.fallbackRafTimers.set(id, timer)
    return id
  }

  cancelRaf = (id: number): void => {
    if (this.nativeRafIds.has(id)) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(id)
      }
      this.nativeRafIds.delete(id)
      return
    }

    const timer = this.fallbackRafTimers.get(id)
    if (!timer) return
    clearTimeout(timer)
    this.fallbackRafTimers.delete(id)
  }

  cancelAll = () => {
    if (typeof cancelAnimationFrame === 'function') {
      this.nativeRafIds.forEach((id) => {
        cancelAnimationFrame(id)
      })
    }
    this.nativeRafIds.clear()

    this.fallbackRafTimers.forEach((timer) => {
      clearTimeout(timer)
    })
    this.fallbackRafTimers.clear()
  }
}
