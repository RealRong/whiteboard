import { useCallback, useRef } from 'react'
import type { Point } from '@whiteboard/core'
import type { WhiteboardInstance } from 'types/instance'

type Options = {
  instance: WhiteboardInstance
  minZoom?: number
  maxZoom?: number
  enablePan?: boolean
  enableWheel?: boolean
  wheelSensitivity?: number
}

type DragState = {
  pointerId: number
  start: Point
  startCenter: Point
  startZoom: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const useCanvasViewportHandlers = ({
  instance,
  minZoom = 0.1,
  maxZoom = 4,
  enablePan = true,
  enableWheel = true,
  wheelSensitivity = instance.runtime.config.viewport.wheelSensitivity
}: Options) => {
  const dragRef = useRef<DragState | null>(null)

  const onPointerDown = useCallback(
    (event: PointerEvent | (PointerEvent & { currentTarget: HTMLElement })) => {
      if (!enablePan) return
      const viewport = instance.runtime.viewport.get()
      const isMiddle = event.button === 1
      const isSpaceLeft = event.button === 0 && instance.state.read('spacePressed')
      if (!isMiddle && !isSpaceLeft) return
      event.preventDefault()
      const target = event.currentTarget as HTMLElement | null
      target?.setPointerCapture(event.pointerId)
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        startCenter: { ...viewport.center },
        startZoom: viewport.zoom
      }
    },
    [enablePan, instance]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.start.x
      const dy = event.clientY - drag.start.y
      instance.runtime.core.dispatch({
        type: 'viewport.set',
        viewport: {
          center: {
            x: drag.startCenter.x - dx / drag.startZoom,
            y: drag.startCenter.y - dy / drag.startZoom
          },
          zoom: drag.startZoom
        }
      })
    },
    [instance]
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
      event.preventDefault()
      const zoom = instance.runtime.viewport.getZoom()
      const anchor = instance.runtime.viewport.screenToWorld(
        instance.runtime.viewport.clientToScreen(event.clientX, event.clientY)
      )
      const factor = Math.exp(-event.deltaY * wheelSensitivity)
      const nextZoom = clamp(zoom * factor, minZoom, maxZoom)
      const appliedFactor = nextZoom / zoom
      if (appliedFactor === 1) return
      instance.runtime.core.dispatch({
        type: 'viewport.zoom',
        factor: appliedFactor,
        anchor
      })
    },
    [enableWheel, instance, maxZoom, minZoom, wheelSensitivity]
  )

  return {
    onPointerDownCapture: onPointerDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel
  }
}
