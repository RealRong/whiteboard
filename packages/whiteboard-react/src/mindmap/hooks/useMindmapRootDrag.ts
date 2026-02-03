import { useCallback, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Core, Node, Point } from '@whiteboard/core'

type UseMindmapRootDragOptions = {
  mindmapNode: Node
  core: Core
  getWorldPoint: (event: PointerEvent<HTMLElement>) => Point
}

export const useMindmapRootDrag = ({ mindmapNode, core, getWorldPoint }: UseMindmapRootDragOptions) => {
  const [nodeOffset, setNodeOffset] = useState<Point>(() => ({ x: mindmapNode.position.x, y: mindmapNode.position.y }))
  const rootDragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)

  const baseOffset = rootDragRef.current ? nodeOffset : mindmapNode.position

  const startRootDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      setNodeOffset({ x: mindmapNode.position.x, y: mindmapNode.position.y })
      rootDragRef.current = {
        pointerId: event.pointerId,
        start: getWorldPoint(event),
        origin: { x: mindmapNode.position.x, y: mindmapNode.position.y }
      }
    },
    [getWorldPoint, mindmapNode.position.x, mindmapNode.position.y]
  )

  const updateRootDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rootDrag = rootDragRef.current
      if (!rootDrag || rootDrag.pointerId !== event.pointerId) return false
      event.preventDefault()
      const world = getWorldPoint(event)
      const dx = world.x - rootDrag.start.x
      const dy = world.y - rootDrag.start.y
      setNodeOffset({ x: rootDrag.origin.x + dx, y: rootDrag.origin.y + dy })
      return true
    },
    [getWorldPoint]
  )

  const endRootDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rootDrag = rootDragRef.current
      if (!rootDrag || rootDrag.pointerId !== event.pointerId) return false
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.releasePointerCapture(event.pointerId)
      rootDragRef.current = null
      commitNodeOffset(mindmapNode, core, nodeOffset)
      return true
    },
    [core, mindmapNode, nodeOffset]
  )

  const cancelRootDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rootDrag = rootDragRef.current
    if (!rootDrag || rootDrag.pointerId !== event.pointerId) return false
    event.preventDefault()
    rootDragRef.current = null
    return true
  }, [])

  return {
    baseOffset,
    startRootDrag,
    updateRootDrag,
    endRootDrag,
    cancelRootDrag
  }
}

const commitNodeOffset = (mindmapNode: Node, core: Core, position: Point) => {
  if (Math.abs(mindmapNode.position.x - position.x) < 0.5 && Math.abs(mindmapNode.position.y - position.y) < 0.5) {
    return
  }
  void core.dispatch({
    type: 'node.update',
    id: mindmapNode.id,
    patch: { position: { x: position.x, y: position.y } }
  })
}
