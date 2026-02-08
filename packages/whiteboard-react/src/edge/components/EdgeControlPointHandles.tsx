import type { Core, Edge, Point } from '@whiteboard/core'
import type { KeyboardEvent, MouseEvent, PointerEvent, RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

const HANDLE_SIZE = 10

const EDGE_CONTROL_POINT_HANDLE_CLASS = 'wb-edge-control-point-handle'

const EDGE_CONTROL_POINT_HANDLE_STYLE = `
.${EDGE_CONTROL_POINT_HANDLE_CLASS} {
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
  transition: box-shadow 120ms ease;
}
.${EDGE_CONTROL_POINT_HANDLE_CLASS}:hover,
.${EDGE_CONTROL_POINT_HANDLE_CLASS}:focus-visible,
.${EDGE_CONTROL_POINT_HANDLE_CLASS}[data-active='true'] {
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}
`

type DragState = {
  pointerId: number
  index: number
  start: Point
  origin: Point
  points: Point[]
}

type EdgeControlPointHandlesProps = {
  core: Core
  edges: Edge[]
  selectedEdgeId?: string
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
}

export const EdgeControlPointHandles = ({
  core,
  edges,
  selectedEdgeId,
  containerRef,
  screenToWorld
}: EdgeControlPointHandlesProps) => {
  const dragRef = useRef<DragState | null>(null)
  const edge = selectedEdgeId ? edges.find((item) => item.id === selectedEdgeId) : undefined
  const points = edge?.routing?.points ?? []
  const hasPoints = points.length > 0
  const editable = edge && edge.type !== 'bezier' && edge.type !== 'curve'
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    setActiveIndex(null)
  }, [edge?.id])

  const getWorldPoint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (screenToWorld && containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        return screenToWorld(screenPoint)
      }
      const rect = event.currentTarget.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    },
    [containerRef, screenToWorld]
  )

  const updatePoints = useCallback(
    (nextPoints: Point[]) => {
      if (!edge) return
      core.dispatch({
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      })
    },
    [core, edge]
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
    const nextPoints = drag.points.map((point, idx) =>
      idx === drag.index
        ? {
            x: drag.origin.x + dx,
            y: drag.origin.y + dy
          }
        : point
    )
    updatePoints(nextPoints)
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
    const nextPoints = points.filter((_, idx) => idx !== index)
    if (nextPoints.length === 0) {
      core.dispatch({
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'auto',
            points: undefined
          }
        }
      })
      return
    }
    updatePoints(nextPoints)
  }

  if (!editable || !hasPoints) return null

  const handleHalfExpr = `calc(${HANDLE_SIZE}px / var(--wb-zoom, 1) / 2)`

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8 }}>
      <style>{EDGE_CONTROL_POINT_HANDLE_STYLE}</style>
      {points.map((point, index) => (
        <div
          key={`${edge.id}-point-${index}`}
          data-selection-ignore
          className={EDGE_CONTROL_POINT_HANDLE_CLASS}
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
            if (nextPoints.length === 0) {
              core.dispatch({
                type: 'edge.update',
                id: edge.id,
                patch: {
                  routing: {
                    ...(edge.routing ?? {}),
                    mode: 'auto',
                    points: undefined
                  }
                }
              })
              setActiveIndex(null)
              return
            }
            updatePoints(nextPoints)
            setActiveIndex(Math.min(index, nextPoints.length - 1))
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `calc(${HANDLE_SIZE}px / var(--wb-zoom, 1))`,
            height: `calc(${HANDLE_SIZE}px / var(--wb-zoom, 1))`,
            borderRadius: 999,
            background: '#ffffff',
            border:
              index === activeIndex
                ? 'calc(2px / var(--wb-zoom, 1)) solid #1d4ed8'
                : 'calc(2px / var(--wb-zoom, 1)) solid #2563eb',
            cursor: 'grab',
            transform: `translate(calc(${point.x}px - ${handleHalfExpr}), calc(${point.y}px - ${handleHalfExpr})) ${
              index === activeIndex ? 'scale(1.08)' : 'scale(1)'
            }`,
            pointerEvents: 'auto'
          }}
          tabIndex={0}
        />
      ))}
    </div>
  )
}
