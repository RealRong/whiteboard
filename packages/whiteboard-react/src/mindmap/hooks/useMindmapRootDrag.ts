import { useCallback, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Node, Point } from '@whiteboard/core'

type UseMindmapRootDragOptions = {
  mindmapNode: Node
  getWorldPoint: (event: PointerEvent<HTMLElement>) => Point
  commitRootPosition: (position: Point) => void
}

export const useMindmapRootDrag = ({ mindmapNode, getWorldPoint, commitRootPosition }: UseMindmapRootDragOptions) => {
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
      commitRootPosition(nodeOffset)
      return true
    },
    [commitRootPosition, nodeOffset]
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
