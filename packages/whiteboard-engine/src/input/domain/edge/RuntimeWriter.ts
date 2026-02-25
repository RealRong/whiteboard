import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'

type WriterOptions = {
  instance: Pick<InternalInstance, 'state' | 'mutate'>
}

export class RuntimeWriter {
  private readonly state: WriterOptions['instance']['state']
  private readonly mutate: WriterOptions['instance']['mutate']

  constructor({ instance }: WriterOptions) {
    this.state = instance.state
    this.mutate = instance.mutate
  }

  private clearInteractionKinds = (kinds: readonly ('edgeConnect' | 'routingDrag')[]) => {
    this.state.write('interactionSession', (prev) => {
      if (!prev.active) return prev
      if (!kinds.includes(prev.active.kind as 'edgeConnect' | 'routingDrag')) {
        return prev
      }
      return {}
    })
  }

  private writeInteractionSession = (
    kind: 'edgeConnect' | 'routingDrag',
    pointerId: number | null
  ) => {
    this.state.write('interactionSession', (prev) => {
      if (pointerId === null) {
        if (prev.active?.kind !== kind) return prev
        return {}
      }
      if (
        prev.active?.kind === kind
        && prev.active.pointerId === pointerId
      ) {
        return prev
      }
      return {
        active: {
          kind,
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
      if (output.clearInteractions?.length) {
        this.clearInteractionKinds(output.clearInteractions)
      }
      if (output.interaction) {
        this.writeInteractionSession(
          output.interaction.kind,
          output.interaction.pointerId
        )
      }
      if (output.edgeConnect !== undefined) {
        this.state.write('edgeConnect', output.edgeConnect as never)
      }
      if (output.routingDrag !== undefined) {
        this.state.write('routingDrag', output.routingDrag as never)
      }
      if (output.selection !== undefined) {
        this.state.write('selection', output.selection as never)
      }
      if (output.mutations?.length) {
        void this.mutate(output.mutations, 'interaction')
      }
    })
  }
}
