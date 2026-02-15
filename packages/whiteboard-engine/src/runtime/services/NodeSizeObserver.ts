import { trimNumber } from '@whiteboard/core'
import type { Core, NodeId, Size } from '@whiteboard/core'
import type { NodeSizeObserverService as NodeSizeObserverServiceApi } from '@engine-types/instance'
import type { PendingNodeSizeUpdate } from '@engine-types/instance/services'


export class NodeSizeObserverService implements NodeSizeObserverServiceApi {
  private core: Core
  private observer: ResizeObserver | null = null
  private observed = new Map<NodeId, Element>()
  private elementToId = new WeakMap<Element, NodeId>()
  private lastSize = new Map<NodeId, Size>()
  private pending = new Map<NodeId, Size>()
  private rafId: number | null = null

  constructor(core: Core) {
    this.core = core
  }

  private flush = () => {
    this.rafId = null
    if (!this.pending.size) return
    const updates: PendingNodeSizeUpdate[] = []
    this.pending.forEach((size, id) => {
      const current = this.lastSize.get(id)
      if (current && Math.abs(current.width - size.width) < 0.5 && Math.abs(current.height - size.height) < 0.5) return
      this.lastSize.set(id, size)
      updates.push({ id, size })
    })
    this.pending.clear()
    if (!updates.length) return
    this.core.model.node.updateMany(
      updates.map((item) => ({
        id: item.id,
        patch: { size: item.size }
      }))
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
      if (this.pending.size && this.rafId === null) {
        this.rafId = requestAnimationFrame(this.flush)
      }
    })
  }

  private disconnect = () => {
    this.observer?.disconnect()
    this.observer = null
    this.observed.clear()
    this.lastSize.clear()
    this.pending.clear()
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  observe: NodeSizeObserverServiceApi['observe'] = (nodeId, element, enabled = true) => {
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

  unobserve: NodeSizeObserverServiceApi['unobserve'] = (nodeId) => {
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

  dispose: NodeSizeObserverServiceApi['dispose'] = () => {
    this.disconnect()
  }
}
