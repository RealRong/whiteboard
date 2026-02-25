import type { Size } from '@engine-types/common'
import type { ProjectionStore } from '@engine-types/projection'
import type { Scheduler } from '../Scheduler'
import { FrameTask } from '../TaskQueue'
import type { NodeId, Operation } from '@whiteboard/core/types'
import type { ApplyMutationsApi } from '@engine-types/command'

type Options = {
  scheduler: Scheduler
  projection: ProjectionStore
  mutate: ApplyMutationsApi
}

const MEASURE_EPSILON = 0.5

const isValidSize = (size: Size) =>
  Number.isFinite(size.width)
  && Number.isFinite(size.height)
  && size.width > 0
  && size.height > 0

const isSameSize = (left: Size, right: Size) =>
  Math.abs(left.width - right.width) < MEASURE_EPSILON
  && Math.abs(left.height - right.height) < MEASURE_EPSILON

export class NodeMeasureQueue {
  private readonly projection: ProjectionStore
  private readonly mutate: ApplyMutationsApi
  private readonly flushTask: FrameTask
  private readonly pending = new Map<NodeId, Size>()
  private readonly committed = new Map<NodeId, Size>()

  constructor({ scheduler, projection, mutate }: Options) {
    this.projection = projection
    this.mutate = mutate
    this.flushTask = new FrameTask(scheduler, this.flush)
  }

  enqueue = (id: NodeId, size: Size) => {
    if (!isValidSize(size)) return
    this.pending.set(id, {
      width: size.width,
      height: size.height
    })
    this.flushTask.schedule()
  }

  clear = () => {
    this.flushTask.cancel()
    this.pending.clear()
    this.committed.clear()
  }

  private flush = () => {
    if (!this.pending.size) return
    const nodeById = this.projection.getSnapshot().indexes.canvasNodeById
    const operations: Operation[] = []

    this.pending.forEach((size, nodeId) => {
      if (!nodeById.has(nodeId)) return
      const prev = this.committed.get(nodeId)
      if (prev && isSameSize(prev, size)) return
      this.committed.set(nodeId, size)
      operations.push({
        type: 'node.update',
        id: nodeId,
        patch: { size }
      })
    })
    this.pending.clear()

    if (!operations.length) return
    void this.mutate(operations, 'system')
  }
}
