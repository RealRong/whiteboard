type Unsubscribe = () => void

export class WatchGroup {
  private started = false
  private unsubs: Unsubscribe[] = []

  start = (
    bind: () => Unsubscribe[],
    onStarted?: () => void
  ) => {
    if (this.started) return
    this.started = true
    this.unsubs = bind()
    onStarted?.()
  }

  stop = (onStopped?: () => void) => {
    if (!this.started && this.unsubs.length === 0) return
    this.started = false
    this.unsubs.forEach((off) => off())
    this.unsubs = []
    onStopped?.()
  }
}
