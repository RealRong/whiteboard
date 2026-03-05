import type { Scheduler } from '../../runtime/Scheduler'
import { MicrotaskTask } from '../../runtime/TaskQueue'

type QueueOptions = {
  scheduler: Scheduler
  onTopic: (topic: string) => void
}

export class ReactionTaskQueue {
  private readonly pendingTopics = new Set<string>()
  private readonly onTopic: QueueOptions['onTopic']
  private readonly microtaskFlush: MicrotaskTask
  private disposed = false

  constructor({ scheduler, onTopic }: QueueOptions) {
    this.onTopic = onTopic
    this.microtaskFlush = new MicrotaskTask(scheduler, () => {
      if (!this.disposed) this.flush()
    })
  }

  enqueue = (topic: string) => {
    if (this.disposed) return
    this.pendingTopics.add(topic)
    this.microtaskFlush.schedule()
  }

  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    this.pendingTopics.clear()
    this.microtaskFlush.cancel()
  }

  private flush = () => {
    if (this.disposed) return
    const topics = Array.from(this.pendingTopics)
    if (!topics.length) return
    this.pendingTopics.clear()

    topics.forEach((topic) => {
      this.onTopic(topic)
    })
  }
}
