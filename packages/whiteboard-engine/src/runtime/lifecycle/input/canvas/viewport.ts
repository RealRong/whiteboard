import type { Instance } from '@engine-types/instance'
import { DEFAULT_CONFIG } from '../../../../config'

type Options = {
  instance: Instance
  minZoom?: number
  maxZoom?: number
  enablePan?: boolean
  enableWheel?: boolean
  wheelSensitivity?: number
}

export const createViewport = ({
  instance,
  minZoom = DEFAULT_CONFIG.viewport.minZoom,
  maxZoom = DEFAULT_CONFIG.viewport.maxZoom,
  enablePan = DEFAULT_CONFIG.viewport.enablePan,
  enableWheel = DEFAULT_CONFIG.viewport.enableWheel,
  wheelSensitivity = instance.runtime.config.viewport.wheelSensitivity
}: Options) => {
  const viewportNavigation = instance.runtime.services.viewportNavigation

  const onPointerDown = (event: PointerEvent | (PointerEvent & { currentTarget: HTMLElement })) => {
    const handled = viewportNavigation.startPan({
      pointerId: event.pointerId,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      spacePressed: instance.state.read('spacePressed'),
      enablePan
    })
    if (!handled) return

    event.preventDefault()
    const target = event.currentTarget as HTMLElement | null
    target?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    viewportNavigation.updatePan({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
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
