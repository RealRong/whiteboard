import type { Edge, Point } from '@whiteboard/core'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useInstance, useVisibleEdges } from '../../common/hooks'
import { useEdgeConnectLayerState } from '../hooks'

type DragState = {
  pointerId: number
  index: number
  start: Point
  origin: Point
  points: Point[]
}

type EdgeControlPointHandlesProps = {
  onMovePoint?: (edge: Edge, index: number, pointWorld: Point) => void
  onRemovePoint?: (edge: Edge, index: number) => void
}

export const EdgeControlPointHandles = ({
  onMovePoint,
  onRemovePoint
}: EdgeControlPointHandlesProps) => {
  const instance = useInstance()
  const visibleEdges = useVisibleEdges()
  const { selectedEdgeId: stateSelectedEdgeId } = useEdgeConnectLayerState()
  const dragRef = useRef<DragState | null>(null)
  const containerRef = instance.runtime.containerRef
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const movePoint = onMovePoint ?? instance.commands.edge.moveRoutingPoint
  const removePoint = onRemovePoint ?? instance.commands.edge.removeRoutingPoint
  const edge = stateSelectedEdgeId ? visibleEdges.find((item) => item.id === stateSelectedEdgeId) : undefined
  const points = edge?.routing?.points ?? []
  const hasPoints = points.length > 0
  const editable = edge && edge.type !== 'bezier' && edge.type !== 'curve'
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    setActiveIndex(null)
  }, [edge?.id])

  const getWorldPoint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current!.getBoundingClientRect()
      const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      return screenToWorld(screenPoint)
    },
    [containerRef, screenToWorld]
  )

  const updatePoints = useCallback(
    (index: number, pointWorld: Point) => {
      if (!edge) return
      movePoint(edge, index, pointWorld)
    },
    [edge, movePoint]
  )

  const handlePointerDown = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (!edge) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveIndex(index)
    const start = getWorldPoint(event)
    dragRef.current = {
      pointerId: event.pointerId,
      index,
      start,
      origin: points[index],
      points
    }
  }

  const handlePointerMove = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (!edge) return
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.index !== index) return
    const current = getWorldPoint(event)
    const dx = current.x - drag.start.x
    const dy = current.y - drag.start.y
    const nextPoint = {
      x: drag.origin.x + dx,
      y: drag.origin.y + dy
    }
    updatePoints(index, nextPoint)
  }

  const handlePointerUp = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (!edge) return
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.index !== index) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleDoubleClick = (index: number) => (event: MouseEvent<HTMLDivElement>) => {
    if (!edge) return
    event.preventDefault()
    event.stopPropagation()
    removePoint(edge, index)
  }

  if (!editable || !hasPoints) return null

  return (
    <div className="wb-edge-control-point-layer">
      {points.map((point, index) => (
        <div
          key={`${edge.id}-point-${index}`}
          data-selection-ignore
          className="wb-edge-control-point-handle"
          data-active={index === activeIndex ? 'true' : undefined}
          onPointerDown={handlePointerDown(index)}
          onPointerMove={handlePointerMove(index)}
          onPointerUp={handlePointerUp(index)}
          onDoubleClick={handleDoubleClick(index)}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setActiveIndex(null)
              return
            }
            if (event.key !== 'Backspace' && event.key !== 'Delete') return
            event.preventDefault()
            event.stopPropagation()
            const nextPoints = points.filter((_, idx) => idx !== index)
            removePoint(edge, index)
            if (nextPoints.length === 0) {
              setActiveIndex(null)
              return
            }
            setActiveIndex(Math.min(index, nextPoints.length - 1))
          }}
          style={{
            '--wb-edge-control-point-x': point.x,
            '--wb-edge-control-point-y': point.y,
            '--wb-edge-control-point-scale': index === activeIndex ? 1.08 : 1
          } as CSSProperties}
          tabIndex={0}
        />
      ))}
    </div>
  )
}
