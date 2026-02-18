type Unsubscribe = () => void

type Options = {
  bind: () => Unsubscribe[]
  emitCurrent: () => void
}

export const createWatcherLifecycle = ({
  bind,
  emitCurrent
}: Options) => {
  let started = false
  let unsubs: Unsubscribe[] = []

  const start = () => {
    if (started) return
    started = true
    unsubs = bind()
    emitCurrent()
  }

  const stop = () => {
    if (!started && !unsubs.length) return
    started = false
    unsubs.forEach((off) => off())
    unsubs = []
  }

  return {
    start,
    stop
  }
}
