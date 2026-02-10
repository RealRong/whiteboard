import type { Edge, Point } from '@whiteboard/core'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useInstance } from '../../common/hooks'
import { useEdgeConnectLayerState, useVisibleEdges } from '../hooks'

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
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const movePoint = onMovePoint ?? instance.commands.edge.moveRoutingPoint
  const removePoint = onRemovePoint ?? instance.commands.edge.removeRoutingPoint
  const edge = stateSelectedEdgeId ? visibleEdges.find((item) => item.id === stateSelectedEdgeId) : undefined
  const points = edge?.routing?.points ?? []
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    setActiveIndex(null)
  }, [edge?.id])

  if (!edge || points.length === 0 || edge.type === 'bezier' || edge.type === 'curve') return null

  const getActiveDrag = (index: number, pointerId: number) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== pointerId || drag.index !== index) return null
    return drag
  }

  const removePointAt = (index: number) => {
    removePoint(edge, index)
  }

  const handlePointerDown = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveIndex(index)
    const start = screenToWorld(clientToScreen(event.clientX, event.clientY))
    dragRef.current = {
      pointerId: event.pointerId,
      index,
      start,
      origin: points[index],
      points
    }
  }

  const handlePointerMove = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    const drag = getActiveDrag(index, event.pointerId)
    if (!drag) return
    const current = screenToWorld(clientToScreen(event.clientX, event.clientY))
    const dx = current.x - drag.start.x
    const dy = current.y - drag.start.y
    const nextPoint = {
      x: drag.origin.x + dx,
      y: drag.origin.y + dy
    }
    movePoint(edge, index, nextPoint)
  }

  const handlePointerUp = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (!getActiveDrag(index, event.pointerId)) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleDoubleClick = (index: number) => (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    removePointAt(index)
  }

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
            const nextPointCount = points.length - 1
            removePointAt(index)
            if (nextPointCount <= 0) {
              setActiveIndex(null)
              return
            }
            setActiveIndex(Math.min(index, nextPointCount - 1))
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
