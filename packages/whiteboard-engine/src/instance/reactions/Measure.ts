import type { Size } from '@engine-types/common/base'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { Apply } from '@engine-types/write/commands'
import type { Scheduler } from '../../runtime/Scheduler'
import { FrameTask } from '../../runtime/TaskQueue'
import type { NodeId } from '@whiteboard/core/types'

type Options = {
  instance: Pick<InternalInstance, 'document'>
  apply: Apply
  scheduler: Scheduler
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

export class Measure {
  private readonly instance: Options['instance']
  private readonly apply: Options['apply']
  private readonly flushTask: FrameTask
  private readonly pending = new Map<NodeId, Size>()
  private readonly committed = new Map<NodeId, Size>()

  constructor({ instance, apply, scheduler }: Options) {
    this.instance = instance
    this.apply = apply
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
    const doc = this.instance.document.get()
    const nodeIds = new Set(doc.nodes.map((node) => node.id))
    const updates: Array<{ id: NodeId; size: Size }> = []

    this.pending.forEach((size, nodeId) => {
      if (!nodeIds.has(nodeId)) return
      const prev = this.committed.get(nodeId)
      if (prev && isSameSize(prev, size)) return
      this.committed.set(nodeId, size)
      updates.push({ id: nodeId, size })
    })
    this.pending.clear()

    if (!updates.length) return
    updates.forEach(({ id, size }) => {
      void this.apply({
        domain: 'node',
        command: {
          type: 'update',
          id,
          patch: { size }
        },
        source: 'system'
      })
    })
  }
}
