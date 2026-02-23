import { trimNumber } from '@whiteboard/core/utils'
import type { NodeId, Size } from '@whiteboard/core/types'
import type { ApplyMutationsApi } from '@engine-types/command'
import type { Scheduler } from '../../../contracts'
import { FrameTask } from '../../../TaskQueue'
import type {
  NodeSizeObserver as NodeSizeObserverApi,
  PendingNodeSizeUpdate
} from '@engine-types/instance/services'
import { DEFAULT_TUNING } from '../../../../config'

export class NodeSizeObserver implements NodeSizeObserverApi {
  private readonly mutate: ApplyMutationsApi
  private readonly flushTask: FrameTask
  private observer: ResizeObserver | null = null
  private observed = new Map<NodeId, Element>()
  private elementToId = new WeakMap<Element, NodeId>()
  private lastSize = new Map<NodeId, Size>()
  private pending = new Map<NodeId, Size>()

  constructor(
    mutate: ApplyMutationsApi,
    scheduler: Scheduler
  ) {
    this.mutate = mutate
    this.flushTask = new FrameTask(scheduler, this.flush)
  }

  private flush = () => {
    if (!this.pending.size) return
    const updates: PendingNodeSizeUpdate[] = []
    this.pending.forEach((size, id) => {
      const current = this.lastSize.get(id)
      if (
        current &&
        Math.abs(current.width - size.width) < DEFAULT_TUNING.nodeSizeObserver.sizeEpsilon &&
        Math.abs(current.height - size.height) < DEFAULT_TUNING.nodeSizeObserver.sizeEpsilon
      ) {
        return
      }
      this.lastSize.set(id, size)
      updates.push({ id, size })
    })
    this.pending.clear()
    if (!updates.length) return
    void this.mutate(
      updates.map((item) => ({
        type: 'node.update',
        id: item.id,
        patch: { size: item.size }
      })),
      'system'
    )
  }

  private ensureObserver = () => {
    if (this.observer) return
    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement | null
        if (!target) continue
        const nodeId = this.elementToId.get(target)
        if (!nodeId) continue
        const box = entry.borderBoxSize?.[0]
        const width = trimNumber(box?.inlineSize ?? entry.contentRect.width)
        const height = trimNumber(box?.blockSize ?? entry.contentRect.height)
        if (width <= 0 || height <= 0) continue
        this.pending.set(nodeId, { width, height })
      }
      if (this.pending.size) this.flushTask.schedule()
    })
  }

  private disconnect = () => {
    this.observer?.disconnect()
    this.observer = null
    this.observed.clear()
    this.lastSize.clear()
    this.pending.clear()
    this.flushTask.cancel()
  }

  observe: NodeSizeObserverApi['observe'] = (nodeId, element, enabled = true) => {
    if (!enabled) {
      this.unobserve(nodeId)
      return
    }
    this.ensureObserver()
    const prev = this.observed.get(nodeId)
    if (prev && prev !== element) {
      this.observer?.unobserve(prev)
    }
    if (prev !== element) {
      this.observed.set(nodeId, element)
      this.elementToId.set(element, nodeId)
      this.observer?.observe(element)
    }
  }

  unobserve: NodeSizeObserverApi['unobserve'] = (nodeId) => {
    const prev = this.observed.get(nodeId)
    if (prev) {
      this.observer?.unobserve(prev)
    }
    this.observed.delete(nodeId)
    this.lastSize.delete(nodeId)
    this.pending.delete(nodeId)
    if (!this.observed.size) {
      this.disconnect()
    }
  }

  dispose: NodeSizeObserverApi['dispose'] = () => {
    this.disconnect()
  }
}
