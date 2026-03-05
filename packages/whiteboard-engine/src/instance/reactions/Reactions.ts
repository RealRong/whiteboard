import type { InternalInstance } from '@engine-types/instance/engine'
import type { Scheduler } from '../../runtime/Scheduler'
import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import { Autofit } from './Autofit'
import { ReactionTaskQueue } from './Queue'
import { createReactionRegistry } from './registry'

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  readRuntime: {
    applyInvalidation: (invalidation: ReadInvalidation) => void
  }
  writeRuntime: Pick<WriteRuntime, 'changeBus' | 'apply'>
  scheduler: Scheduler
}

export type Reactions = {
  dispose: () => void
}

export const createReactions = ({
  instance,
  readRuntime,
  writeRuntime,
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
      void writeRuntime.apply(payload)
    }
  })
  let disposed = false

  registry.seed(taskQueue.enqueue)

  const offChange = writeRuntime.changeBus.subscribe((change) => {
    readRuntime.applyInvalidation(change.readHints)
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
