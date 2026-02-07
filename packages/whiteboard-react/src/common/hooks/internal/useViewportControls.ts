import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { Core, Point, Viewport } from '@whiteboard/core'
import { useSpacePressed } from '../useSpacePressed'

type Options = {
  core: Core
  viewport: Viewport
  screenToWorld: (point: Point) => Point
  containerRef: RefObject<HTMLElement | null>
  minZoom?: number
  maxZoom?: number
  enablePan?: boolean
  enableWheel?: boolean
}

type DragState = {
  pointerId: number
  start: Point
  startCenter: Point
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const useViewportControls = ({
  core,
  viewport,
  screenToWorld,
  containerRef,
  minZoom = 0.1,
  maxZoom = 4,
  enablePan = true,
  enableWheel = true
}: Options) => {
  const dragRef = useRef<DragState | null>(null)
  const spacePressed = useSpacePressed()

  const onPointerDown = useCallback(
    (event: PointerEvent | (PointerEvent & { currentTarget: HTMLElement })) => {
      if (!enablePan) return
      const isMiddle = event.button === 1
      const isSpaceLeft = event.button === 0 && spacePressed
      if (!isMiddle && !isSpaceLeft) return
      event.preventDefault()
      const target = event.currentTarget as HTMLElement | null
      target?.setPointerCapture(event.pointerId)
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        startCenter: { ...viewport.center }
      }
    },
    [enablePan, spacePressed, viewport.center.x, viewport.center.y]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.start.x
      const dy = event.clientY - drag.start.y
      core.dispatch({
        type: 'viewport.set',
        viewport: {
          center: {
            x: drag.startCenter.x - dx / viewport.zoom,
            y: drag.startCenter.y - dy / viewport.zoom
          },
          zoom: viewport.zoom
        }
      })
    },
    [core, viewport.zoom]
  )

  const onPointerUp = useCallback((event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const target = event.currentTarget as HTMLElement | null
    target?.releasePointerCapture(event.pointerId)
  }, [])

  const onWheel = useCallback(
    (event: WheelEvent) => {
      if (!enableWheel) return
      const element = containerRef.current
      if (!element) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const anchor = screenToWorld(screenPoint)
      const factor = Math.exp(-event.deltaY * 0.001)
      const nextZoom = clamp(viewport.zoom * factor, minZoom, maxZoom)
      const appliedFactor = nextZoom / viewport.zoom
      if (appliedFactor === 1) return
      core.dispatch({
        type: 'viewport.zoom',
        factor: appliedFactor,
        anchor
      })
    },
    [containerRef, core, enableWheel, maxZoom, minZoom, screenToWorld, viewport.zoom]
  )

  return {
    onPointerDownCapture: onPointerDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel
  }
}
