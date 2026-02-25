import type { InternalInstance } from '@engine-types/instance/instance'
import type { Operation } from '@whiteboard/core/types'

type WriterInstance = Pick<InternalInstance, 'render'> & {
  mutate?: InternalInstance['mutate']
}

type FrameOutput = {
  frame?: boolean
}

export abstract class InteractionWriter<TOutput extends FrameOutput> {
  protected readonly render: WriterInstance['render']
  private readonly mutate?: WriterInstance['mutate']

  constructor(instance: WriterInstance) {
    this.render = instance.render
    this.mutate = instance.mutate
  }

  protected inRenderBatch = (output: TOutput, runner: () => void) => {
    const runBatch = output.frame
      ? this.render.batchFrame
      : this.render.batch
    runBatch(runner)
  }

  protected submitMutations = (operations?: Operation[]) => {
    if (!operations?.length || !this.mutate) return
    void this.mutate(operations, 'interaction')
  }
}
