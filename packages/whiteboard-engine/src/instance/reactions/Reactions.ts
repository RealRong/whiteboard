import type { InternalInstance } from '@engine-types/instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { Write } from '@engine-types/write/runtime'
import { Autofit } from './Autofit'
import { ReactionTaskQueue } from './Queue'
import { createReactionRegistry } from './registry'

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  write: Pick<Write, 'subscribe' | 'apply'>
  scheduler: Scheduler
}

export type Reactions = {
  dispose: () => void
}

export const createReactions = ({
  instance,
  write,
  scheduler
}: ReactionsOptions): Reactions => {
  const registry = createReactionRegistry([
    new Autofit({
      instance
    })
  ])

  const taskQueue = new ReactionTaskQueue({
    scheduler,
    onTopic: (topic) => {
      const payload = registry.flush(topic)
      if (!payload) return
      void write.apply(payload)
    }
  })
  let disposed = false

  registry.seed(taskQueue.enqueue)

  const offChange = write.subscribe((change) => {
    registry.ingest(change, taskQueue.enqueue)
  })

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      offChange()
      taskQueue.dispose()
    }
  }
}
