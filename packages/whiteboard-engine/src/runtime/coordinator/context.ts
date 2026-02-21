import type { EngineContext, SchedulerContext } from './types'

type CreateEngineContextOptions = Omit<EngineContext, 'schedulers'> & {
  schedulers?: Partial<SchedulerContext>
}

const getNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

const queueMicrotaskSafe = (callback: () => void) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback)
    return
  }
  void Promise.resolve().then(callback)
}

let fallbackRafId = 0
const fallbackRafTimers = new Map<number, ReturnType<typeof setTimeout>>()

const requestAnimationFrameSafe = (callback: FrameRequestCallback) => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback)
  }
  const id = ++fallbackRafId
  const timer = setTimeout(() => {
    fallbackRafTimers.delete(id)
    callback(getNow())
  }, 16)
  fallbackRafTimers.set(id, timer)
  return id
}

const cancelAnimationFrameSafe = (id: number) => {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(id)
    return
  }
  const timer = fallbackRafTimers.get(id)
  if (!timer) return
  clearTimeout(timer)
  fallbackRafTimers.delete(id)
}

export const createEngineContext = ({
  schedulers,
  ...rest
}: CreateEngineContextOptions): EngineContext => {
  return {
    ...rest,
    schedulers: {
      raf: schedulers?.raf ?? requestAnimationFrameSafe,
      cancelRaf: schedulers?.cancelRaf ?? cancelAnimationFrameSafe,
      microtask: schedulers?.microtask ?? queueMicrotaskSafe,
      now: schedulers?.now ?? getNow
    }
  }
}
