import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'
import {
  clearInteractionKinds,
  writeInteractionSession
} from '../../shared/interaction/interactionSession'
import { InteractionWriter } from '../../shared/interaction/InteractionWriter'

type WriterOptions = {
  instance: Pick<InternalInstance, 'state' | 'render' | 'mutate'>
}

export class RuntimeWriter extends InteractionWriter<RuntimeOutput> {
  private readonly state: WriterOptions['instance']['state']

  constructor({ instance }: WriterOptions) {
    super(instance)
    this.state = instance.state
  }

  apply = (output: RuntimeOutput) => {
    this.inRenderBatch(output, () => {
      if (output.clearInteractions?.length) {
        clearInteractionKinds(this.render, output.clearInteractions)
      }
      if (output.interaction) {
        writeInteractionSession(
          this.render,
          output.interaction.kind,
          output.interaction.pointerId
        )
      }
      if (output.routingDrag !== undefined) {
        this.render.write('routingDrag', output.routingDrag as never)
      }
      if (output.selection !== undefined) {
        this.state.write('selection', output.selection as never)
      }
      if (output.mutations?.length) {
        this.submitMutations(output.mutations)
      }
    })
  }
}
