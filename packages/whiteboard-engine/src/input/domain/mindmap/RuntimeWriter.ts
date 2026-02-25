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

  private writeInteractionSession = (pointerId: number | null) => {
    this.state.write('interactionSession', (prev) => {
      if (pointerId === null) {
        if (prev.active?.kind !== 'mindmapDrag') return prev
        return {}
      }
      if (
        prev.active?.kind === 'mindmapDrag'
        && prev.active.pointerId === pointerId
      ) {
        return prev
      }
      return {
        active: {
          kind: 'mindmapDrag',
          pointerId
        }
      }
    })
  }

  apply = (output: RuntimeOutput) => {
    const runBatch = output.frame
      ? this.state.batchFrame
      : this.state.batch
    runBatch(() => {
      if (output.interaction) {
        this.writeInteractionSession(output.interaction.pointerId)
      }
      if (output.mindmapDrag !== undefined) {
        this.state.write('mindmapDrag', output.mindmapDrag as never)
      }
    })
  }
}
