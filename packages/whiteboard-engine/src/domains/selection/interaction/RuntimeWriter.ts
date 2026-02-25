import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'
import { clearInteractionKinds } from '../../shared/interaction/interactionSession'
import { InteractionWriter } from '../../shared/interaction/InteractionWriter'

type WriterOptions = {
  instance: Pick<InternalInstance, 'state' | 'render'>
}

export class RuntimeWriter extends InteractionWriter<RuntimeOutput> {
  private readonly state: WriterOptions['instance']['state']

  constructor({ instance }: WriterOptions) {
    super(instance)
    this.state = instance.state
  }

  apply = (output: RuntimeOutput) => {
    this.inRenderBatch(output, () => {
      if (output.clearRoutingInteraction) {
        clearInteractionKinds(this.render, ['routingDrag'])
      }
      if (output.routingDrag !== undefined) {
        this.render.write('routingDrag', output.routingDrag as never)
      }
      if (output.selection !== undefined) {
        this.state.write('selection', output.selection as never)
      }
      if ('groupHover' in output) {
        this.render.write('groupHover', {
          nodeId: output.groupHover
        })
      }
      if (output.selectionBox !== undefined) {
        this.render.write('selectionBox', output.selectionBox as never)
      }
    })
  }
}
