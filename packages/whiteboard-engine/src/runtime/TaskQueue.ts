import type { Scheduler } from './Scheduler'

export class FrameTask {
  private taskId: number | null = null
  private readonly scheduler: Scheduler
  private readonly run: () => void

  constructor(
    scheduler: Scheduler,
    run: () => void
  ) {
    this.scheduler = scheduler
    this.run = run
  }

  schedule = () => {
    if (this.taskId !== null) return
    this.taskId = this.scheduler.raf(() => {
      this.taskId = null
      this.run()
    })
  }

  cancel = () => {
    if (this.taskId === null) return
    this.scheduler.cancelRaf(this.taskId)
    this.taskId = null
  }
}

export class MicrotaskTask {
  private pending = false
  private version = 0
  private readonly scheduler: Scheduler
  private readonly run: () => void

  constructor(
    scheduler: Scheduler,
    run: () => void
  ) {
    this.scheduler = scheduler
    this.run = run
  }

  schedule = () => {
    if (this.pending) return
    this.pending = true
    const token = ++this.version
    this.scheduler.microtask(() => {
      if (!this.pending || token !== this.version) return
      this.pending = false
      this.run()
    })
  }

  cancel = () => {
    this.pending = false
    this.version += 1
  }
}
