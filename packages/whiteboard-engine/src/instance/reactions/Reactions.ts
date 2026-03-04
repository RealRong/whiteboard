import type { InternalInstance } from '@engine-types/instance/engine'
import type { Scheduler } from '../../runtime/Scheduler'
import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import { Autofit } from './Autofit'

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
  const autofit = new Autofit({
    instance,
    apply: writeRuntime.apply,
    scheduler
  })
  let disposed = false

  const offChange = writeRuntime.changeBus.subscribe((change) => {
    readRuntime.applyInvalidation(change.readHints)
  })
  autofit.start(writeRuntime.changeBus)

  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      offChange()
      autofit.dispose()
    }
  }
}
