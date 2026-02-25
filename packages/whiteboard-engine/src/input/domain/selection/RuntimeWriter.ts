import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'

type WriterOptions = {
  instance: Pick<InternalInstance, 'state'>
}

export class RuntimeWriter {
  private readonly state: WriterOptions['instance']['state']

  constructor({ instance }: WriterOptions) {
    this.state = instance.state
  }

  apply = (output: RuntimeOutput) => {
    const runBatch = output.frame
      ? this.state.batchFrame
      : this.state.batch
    runBatch(() => {
      if (output.clearRoutingInteraction) {
        this.state.write('interactionSession', (prev) => {
          if (prev.active?.kind !== 'routingDrag') return prev
          return {}
        })
      }
      if (output.routingDrag !== undefined) {
        this.state.write('routingDrag', output.routingDrag as never)
      }
      if (output.selection !== undefined) {
        this.state.write('selection', output.selection as never)
      }
      if (output.selectionBox !== undefined) {
        this.state.write('selectionBox', output.selectionBox as never)
      }
    })
  }
}
