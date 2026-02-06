import { trimNumber } from '@whiteboard/core'
import type { Core, NodeId, Size } from '@whiteboard/core'

export type NodeSizeObserverService = {
  observe: (nodeId: NodeId, element: Element, enabled?: boolean) => void
  unobserve: (nodeId: NodeId) => void
  dispose: () => void
}

type PendingUpdate = {
  id: NodeId
  size: Size
}

export const createNodeSizeObserverService = (core: Core): NodeSizeObserverService => {
  let observer: ResizeObserver | null = null
  const observed = new Map<NodeId, Element>()
  const elementToId = new WeakMap<Element, NodeId>()
  const lastSize = new Map<NodeId, Size>()
  const pending = new Map<NodeId, Size>()
  let rafId: number | null = null

  const flush = () => {
    rafId = null
    if (!pending.size) return
    const updates: PendingUpdate[] = []
    pending.forEach((size, id) => {
      const current = lastSize.get(id)
      if (current && Math.abs(current.width - size.width) < 0.5 && Math.abs(current.height - size.height) < 0.5) return
      lastSize.set(id, size)
      updates.push({ id, size })
    })
    pending.clear()
    if (!updates.length) return
    core.model.node.updateMany(
      updates.map((item) => ({
        id: item.id,
        patch: { size: item.size }
      }))
    )
  }

  const ensureObserver = () => {
    if (observer) return
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement | null
        if (!target) continue
        const nodeId = elementToId.get(target)
        if (!nodeId) continue
        const box = entry.borderBoxSize?.[0]
        const width = trimNumber(box?.inlineSize ?? entry.contentRect.width)
        const height = trimNumber(box?.blockSize ?? entry.contentRect.height)
        if (width <= 0 || height <= 0) continue
        pending.set(nodeId, { width, height })
      }
      if (pending.size && rafId === null) {
        rafId = requestAnimationFrame(flush)
      }
    })
  }

  const disconnect = () => {
    observer?.disconnect()
    observer = null
    observed.clear()
    lastSize.clear()
    pending.clear()
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const observe = (nodeId: NodeId, element: Element, enabled = true) => {
    if (!enabled) {
      unobserve(nodeId)
      return
    }
    ensureObserver()
    const prev = observed.get(nodeId)
    if (prev && prev !== element) {
      observer?.unobserve(prev)
    }
    if (prev !== element) {
      observed.set(nodeId, element)
      elementToId.set(element, nodeId)
      observer?.observe(element)
    }
  }

  const unobserve = (nodeId: NodeId) => {
    const prev = observed.get(nodeId)
    if (prev) {
      observer?.unobserve(prev)
    }
    observed.delete(nodeId)
    lastSize.delete(nodeId)
    pending.delete(nodeId)
    if (!observed.size) {
      disconnect()
    }
  }

  const dispose = () => {
    disconnect()
  }

  return {
    observe,
    unobserve,
    dispose
  }
}
