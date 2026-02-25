import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'

type WriterOptions = {
  instance: Pick<InternalInstance, 'state' | 'render'>
}

export class RuntimeWriter {
  private readonly state: WriterOptions['instance']['state']
  private readonly render: WriterOptions['instance']['render']

  constructor({ instance }: WriterOptions) {
    this.state = instance.state
    this.render = instance.render
  }

  apply = (output: RuntimeOutput) => {
    const runBatch = output.frame
      ? this.render.batchFrame
      : this.render.batch
    runBatch(() => {
      if (output.clearRoutingInteraction) {
        this.render.write('interactionSession', (prev) => {
          if (prev.active?.kind !== 'routingDrag') return prev
          return {}
        })
      }
      if (output.routingDrag !== undefined) {
        this.render.write('routingDrag', output.routingDrag as never)
      }
      if (output.selection !== undefined) {
        this.state.write('selection', output.selection as never)
      }
      if (output.selectionBox !== undefined) {
        this.render.write('selectionBox', output.selectionBox as never)
      }
    })
  }
}
