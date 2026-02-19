import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import { DEFAULT_CONFIG } from '../../../../config'

type Options = {
  context: LifecycleContext
  minZoom?: number
  maxZoom?: number
  enablePan?: boolean
  enableWheel?: boolean
  wheelSensitivity?: number
}

export const createViewport = ({
  context,
  minZoom = DEFAULT_CONFIG.viewport.minZoom,
  maxZoom = DEFAULT_CONFIG.viewport.maxZoom,
  enablePan = DEFAULT_CONFIG.viewport.enablePan,
  enableWheel = DEFAULT_CONFIG.viewport.enableWheel,
  wheelSensitivity = context.runtime.config.viewport.wheelSensitivity
}: Options) => {
  const viewportNavigation = context.runtime.services.viewportNavigation

  const onPointerDown = (event: PointerEvent | (PointerEvent & { currentTarget: HTMLElement })) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    const handled = viewportNavigation.startPan({
      pointer,
      enablePan
    })
    if (!handled) return

    event.preventDefault()
    const target = event.currentTarget as HTMLElement | null
    target?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    viewportNavigation.updatePan({
      pointer: toPointerInput(context.runtime.viewport, event)
    })
  }

  const onPointerUp = (event: PointerEvent) => {
    const handled = viewportNavigation.endPan({ pointerId: event.pointerId })
    if (!handled) return
    const target = event.currentTarget as HTMLElement | null
    target?.releasePointerCapture(event.pointerId)
  }

  const onWheel = (event: WheelEvent) => {
    const handled = viewportNavigation.applyWheelZoom({
      clientX: event.clientX,
      clientY: event.clientY,
      deltaY: event.deltaY,
      enableWheel,
      minZoom,
      maxZoom,
      wheelSensitivity
    })
    if (!handled) return
    event.preventDefault()
  }

  return {
    onPointerDownCapture: onPointerDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel
  }
}
