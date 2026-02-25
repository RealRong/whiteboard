import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'

type WriterOptions = {
  instance: Pick<InternalInstance, 'render'>
}

export class RuntimeWriter {
  private readonly render: WriterOptions['instance']['render']

  constructor({ instance }: WriterOptions) {
    this.render = instance.render
  }

  private writeInteractionSession = (pointerId: number | null) => {
    this.render.write('interactionSession', (prev) => {
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
      ? this.render.batchFrame
      : this.render.batch
    runBatch(() => {
      if (output.interaction) {
        this.writeInteractionSession(output.interaction.pointerId)
      }
      if (output.mindmapDrag !== undefined) {
        this.render.write('mindmapDrag', output.mindmapDrag as never)
      }
    })
  }
}
