import type { InternalInstance } from '@engine-types/instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { Write } from '@engine-types/write/runtime'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type { WriteInput } from '@engine-types/command/api'
import { MicrotaskTask } from '../../scheduling/Task'
import { Autofit } from './Autofit'

type ReactionModule = {
  seed: () => boolean
  ingest: (invalidation: ReadInvalidation) => boolean
  flush: () => WriteInput | null
}

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  write: Pick<Write, 'apply'>
  scheduler: Scheduler
}

export type Reactions = {
  ingest: (invalidation: ReadInvalidation) => void
  dispose: () => void
}

export const createReactions = ({
  instance,
  write,
  scheduler
}: ReactionsOptions): Reactions => {
  const modules: readonly ReactionModule[] = [
    new Autofit({
      instance
    })
  ]
  let disposed = false

  const flush = () => {
    if (disposed) return
    modules.forEach((module) => {
      const payload = module.flush()
      if (!payload) return
      void write.apply(payload)
    })
  }

  const task = new MicrotaskTask(scheduler, flush)

  modules.forEach((module) => {
    if (module.seed()) {
      task.schedule()
    }
  })

  const ingest = (invalidation: ReadInvalidation) => {
    if (disposed) return
    const scheduled = modules.some((module) => module.ingest(invalidation))
    if (scheduled) {
      task.schedule()
    }
  }

  return {
    ingest,
    dispose: () => {
      if (disposed) return
      disposed = true
      task.cancel()
    }
  }
}
