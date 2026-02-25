import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'
import { writeInteractionSession } from '../shared/interactionSession'
import { InteractionWriter } from '../writer/InteractionWriter'

type WriterOptions = {
  instance: Pick<InternalInstance, 'render'>
}

export class RuntimeWriter extends InteractionWriter<RuntimeOutput> {
  constructor({ instance }: WriterOptions) {
    super(instance)
  }

  apply = (output: RuntimeOutput) => {
    this.inRenderBatch(output, () => {
      if (output.interaction) {
        writeInteractionSession(
          this.render,
          'mindmapDrag',
          output.interaction.pointerId
        )
      }
      if (output.mindmapDrag !== undefined) {
        this.render.write('mindmapDrag', output.mindmapDrag as never)
      }
    })
  }
}
