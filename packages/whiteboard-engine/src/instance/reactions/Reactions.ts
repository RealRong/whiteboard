import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { NodeId } from '@whiteboard/core/types'
import type { Scheduler } from '../../runtime/Scheduler'
import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import { Measure } from './Measure'
import { Autofit } from './Autofit'

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  readRuntime: {
    applyInvalidation: (invalidation: ReadInvalidation) => void
  }
  writeRuntime: Pick<WriteRuntime, 'changeBus' | 'applyWrite'>
  scheduler: Scheduler
}

export type Reactions = {
  nodeMeasured: (id: NodeId, size: Size) => void
  dispose: () => void
}

export const createReactions = ({
  instance,
  readRuntime,
  writeRuntime,
  scheduler
}: ReactionsOptions): Reactions => {
  const measure = new Measure({
    instance,
    applyWrite: writeRuntime.applyWrite,
    scheduler
  })
  const autofit = new Autofit({
    instance,
    applyWrite: writeRuntime.applyWrite,
    scheduler
  })
  let disposed = false

  const offChange = writeRuntime.changeBus.subscribe((change) => {
    readRuntime.applyInvalidation(change.readHints)
    if (change.kind === 'replace') {
      measure.clear()
    }
  })
  autofit.start(writeRuntime.changeBus)

  return {
    nodeMeasured: (id, size) => {
      if (disposed) return
      measure.enqueue(id, size)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      offChange()
      autofit.dispose()
      measure.clear()
    }
  }
}
