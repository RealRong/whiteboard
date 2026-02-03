import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Core, Node, NodeId, Size } from '@whiteboard/core'
import { trimNumber } from '@whiteboard/core'

type UseNodeSizeObserverOptions = {
  core: Core
  nodes: Node[]
  containerRef?: RefObject<HTMLElement>
  enabled?: boolean
}

type PendingUpdate = {
  id: NodeId
  size: Size
}

export const useNodeSizeObserver = ({ core, nodes, containerRef, enabled = true }: UseNodeSizeObserverOptions) => {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const nodeMapRef = useRef(nodeMap)
  const observerRef = useRef<ResizeObserver | null>(null)
  const observedRef = useRef<Map<NodeId, Element>>(new Map())
  const pendingRef = useRef<Map<NodeId, Size>>(new Map())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    nodeMapRef.current = nodeMap
  }, [nodeMap])

  useLayoutEffect(() => {
    if (!enabled) return
    const root = containerRef?.current
    if (!root) return

    const flush = () => {
      rafRef.current = null
      const pending = pendingRef.current
      if (!pending.size) return
      const updates: PendingUpdate[] = []
      pending.forEach((size, id) => {
        const node = nodeMapRef.current.get(id)
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

    const observer = new ResizeObserver((entries) => {
      const pending = pendingRef.current
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
      if (pending.size && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush)
      }
    })

    observerRef.current = observer
    return () => {
      observer.disconnect()
      observerRef.current = null
      observedRef.current.clear()
      pendingRef.current.clear()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [containerRef, core.model.node, enabled])

  useLayoutEffect(() => {
    if (!enabled) return
    const root = containerRef?.current
    const observer = observerRef.current
    if (!root || !observer) return

    const nextObserved = new Map<NodeId, Element>()
    nodes.forEach((node) => {
      const element = root.querySelector(`[data-node-id="${node.id}"]`)
      if (!element) return
      nextObserved.set(node.id, element)
      if (!observedRef.current.has(node.id)) {
        observer.observe(element)
      }
    })

    observedRef.current.forEach((element, id) => {
      if (nextObserved.has(id)) return
      observer.unobserve(element)
    })

    observedRef.current = nextObserved
  }, [nodes, containerRef, enabled])
}
