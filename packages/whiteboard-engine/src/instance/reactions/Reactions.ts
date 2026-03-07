import type { InternalInstance } from '@engine-types/instance/engine'
import type { Scheduler } from '../../scheduling/Scheduler'
import type { Write } from '@engine-types/write/runtime'
import type { ReadImpact } from '@engine-types/read/impact'
import { MicrotaskTask } from '../../scheduling/Task'
import { Autofit } from './Autofit'

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  write: Pick<Write, 'apply'>
  scheduler: Scheduler
}

export type Reactions = {
  ingest: (impact: ReadImpact) => void
  dispose: () => void
}

export const createReactions = ({
  instance,
  write,
  scheduler
}: ReactionsOptions): Reactions => {
  const autofit = new Autofit({ instance })
  let disposed = false

  const task = new MicrotaskTask(scheduler, () => {
    if (disposed) return
    const payload = autofit.flush()
    if (!payload) return
    void write.apply(payload)
  })

  if (autofit.seed()) {
    task.schedule()
  }

  return {
    ingest: (impact) => {
      if (disposed) return
      if (!autofit.ingest(impact)) return
      task.schedule()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      task.cancel()
    }
  }
}
