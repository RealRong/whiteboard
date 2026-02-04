import { trimNumber } from '@whiteboard/core'
import type { Core, Node, NodeId, Size } from '@whiteboard/core'
import type { RefObject } from 'react'

export type NodeSizeObserverService = {
  sync: (nodes: Node[], enabled: boolean) => void
  dispose: () => void
}

type PendingUpdate = {
  id: NodeId
  size: Size
}

export const createNodeSizeObserverService = (core: Core, containerRef: RefObject<HTMLElement>): NodeSizeObserverService => {
  let observer: ResizeObserver | null = null
  let enabled = true
  const observed = new Map<NodeId, Element>()
  const pending = new Map<NodeId, Size>()
  let rafId: number | null = null
  let nodeMap = new Map<NodeId, Node>()

  const flush = () => {
    rafId = null
    if (!pending.size) return
    const updates: PendingUpdate[] = []
    pending.forEach((size, id) => {
      const node = nodeMap.get(id)
      if (!node) return
      const current = node.size
      if (current && Math.abs(current.width - size.width) < 0.5 && Math.abs(current.height - size.height) < 0.5) {
        return
      }
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
        const nodeId = target.dataset.nodeId
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

  const syncObserved = () => {
    if (!observer) return
    const root = containerRef.current
    if (!root) return

    const nextObserved = new Map<NodeId, Element>()
    nodeMap.forEach((_, id) => {
      const element = root.querySelector(`[data-node-id="${id}"]`)
      if (!element) return
      nextObserved.set(id, element)
      if (!observed.has(id)) {
        observer?.observe(element)
      }
    })

    observed.forEach((element, id) => {
      if (nextObserved.has(id)) return
      observer?.unobserve(element)
    })

    observed.clear()
    nextObserved.forEach((element, id) => observed.set(id, element))
  }

  const disconnect = () => {
    observer?.disconnect()
    observer = null
    observed.clear()
    pending.clear()
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const sync = (nodes: Node[], nextEnabled: boolean) => {
    enabled = nextEnabled
    nodeMap = new Map(nodes.map((node) => [node.id, node]))
    if (!enabled) {
      disconnect()
      return
    }
    if (!containerRef.current) return
    ensureObserver()
    syncObserved()
  }

  const dispose = () => {
    disconnect()
  }

  return {
    sync,
    dispose
  }
}
