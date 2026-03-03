import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { NodeId } from '@whiteboard/core/types'
import type { Scheduler } from '../../runtime/Scheduler'
import type { Change } from '@engine-types/write/change'
import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import { Measure } from './Measure'
import { Autofit } from './Autofit'
import { toReadInvalidation } from '../../runtime/read/invalidationAdapter'

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config'>
  readRuntime: {
    applyChange: (change: Change) => void
    applyInvalidation: (invalidation: ReadInvalidation) => void
  }
  writeRuntime: Pick<WriteRuntime, 'changeBus' | 'commands'>
  scheduler: Scheduler
}

export class Reactions {
  private readonly instance: ReactionsOptions['instance']
  private readonly readRuntime: ReactionsOptions['readRuntime']
  private readonly writeRuntime: ReactionsOptions['writeRuntime']
  private readonly measure: Measure
  private readonly autofit: Autofit
  private offChange: (() => void) | null = null
  private disposed = false

  constructor({
    instance,
    readRuntime,
    writeRuntime,
    scheduler
  }: ReactionsOptions) {
    this.instance = instance
    this.readRuntime = readRuntime
    this.writeRuntime = writeRuntime
    this.measure = new Measure({
      instance,
      applyWrite: writeRuntime.commands.write.apply,
      scheduler
    })
    this.autofit = new Autofit({
      instance,
      applyWrite: writeRuntime.commands.write.apply,
      scheduler
    })
  }

  start = () => {
    if (this.disposed || this.offChange) return

    this.offChange = this.writeRuntime.changeBus.subscribe((change) => {
      if (this.instance.config.features.readInvalidationEnabled) {
        this.readRuntime.applyInvalidation(toReadInvalidation(change))
      } else {
        this.readRuntime.applyChange(change)
      }
      if (change.kind === 'replace') {
        this.measure.clear()
      }
    })
    this.autofit.start(this.writeRuntime.changeBus)
  }

  nodeMeasured = (id: NodeId, size: Size) => {
    if (this.disposed) return
    this.measure.enqueue(id, size)
  }

  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    this.offChange?.()
    this.offChange = null
    this.autofit.dispose()
    this.measure.clear()
  }
}
