import type { Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { NodeId } from '@whiteboard/core/types'
import type { Scheduler } from '../../runtime/Scheduler'
import type { ReadOrchestrator } from '../../runtime/read/orchestrator'
import type { WriteRuntime } from '../../runtime/write/createRuntime'
import { Measure } from './Measure'
import { Autofit } from './Autofit'

type ReactionsOptions = {
  instance: Pick<InternalInstance, 'document' | 'config' | 'mutate'>
  readRuntime: Pick<ReadOrchestrator, 'applyChange'>
  writeRuntime: Pick<WriteRuntime, 'changeBus'>
  scheduler: Scheduler
}

export class Reactions {
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
    this.readRuntime = readRuntime
    this.writeRuntime = writeRuntime
    this.measure = new Measure({
      instance,
      scheduler
    })
    this.autofit = new Autofit({
      instance,
      scheduler
    })
  }

  start = () => {
    if (this.disposed || this.offChange) return

    this.offChange = this.writeRuntime.changeBus.subscribe((change) => {
      this.readRuntime.applyChange(change)
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
