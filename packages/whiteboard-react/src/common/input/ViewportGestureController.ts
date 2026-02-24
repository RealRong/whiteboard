import type { Instance } from '@whiteboard/engine'

export type ViewportPolicy = {
  panEnabled: boolean
  wheelEnabled: boolean
  minZoom: number
  maxZoom: number
  wheelSensitivity: number
}

type ViewportGestureControllerOptions = {
  instance: Instance
  viewportPolicy: ViewportPolicy
  getContainer: () => HTMLDivElement | null
}

type ViewportPanState = {
  pointerId: number
  lastX: number
  lastY: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export class ViewportGestureController {
  private readonly instance: Instance
  private readonly viewportPolicy: ViewportPolicy
  private readonly getContainer: () => HTMLDivElement | null
  private viewportPan: ViewportPanState | null = null
  private offPanWindow: (() => void) | null = null

  constructor({
    instance,
    viewportPolicy,
    getContainer
  }: ViewportGestureControllerOptions) {
    this.instance = instance
    this.viewportPolicy = viewportPolicy
    this.getContainer = getContainer
  }

  isPanning = (): boolean => this.viewportPan !== null

  onPointerDown = (event: PointerEvent): boolean => {
    if (!this.canStartViewportPan(event)) return false
    this.viewportPan = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    }
    this.bindPanWindow()
    const container = this.getContainer()
    if (container) {
      try {
        container.setPointerCapture(event.pointerId)
      } catch {
        // Ignore pointer capture failures when pointer is no longer active.
      }
    }
    event.preventDefault()
    return true
  }

  onPointerMove = (event: PointerEvent): boolean => {
    const pan = this.viewportPan
    if (!pan || pan.pointerId !== event.pointerId) return false
    const zoom = this.instance.query.viewport.getZoom()
    if (!Number.isFinite(zoom) || zoom <= 0) return true
    const deltaX = event.clientX - pan.lastX
    const deltaY = event.clientY - pan.lastY
    if (deltaX === 0 && deltaY === 0) return true
    pan.lastX = event.clientX
    pan.lastY = event.clientY
    void this.instance.commands.viewport.panBy({
      x: -deltaX / zoom,
      y: -deltaY / zoom
    })
    event.preventDefault()
    return true
  }

  onPointerUp = (event: PointerEvent): boolean => this.endViewportPan(event)

  onPointerCancel = (event: PointerEvent): boolean => this.endViewportPan(event)

  onWheel = (event: WheelEvent): boolean => {
    if (!this.viewportPolicy.wheelEnabled) return false
    const zoom = this.instance.query.viewport.getZoom()
    if (!Number.isFinite(zoom) || zoom <= 0) return false
    const factor = Math.exp(-event.deltaY * this.viewportPolicy.wheelSensitivity)
    const nextZoom = clamp(
      zoom * factor,
      this.viewportPolicy.minZoom,
      this.viewportPolicy.maxZoom
    )
    const appliedFactor = nextZoom / zoom
    if (appliedFactor === 1) return false
    const anchor = this.instance.query.viewport.clientToWorld(event.clientX, event.clientY)
    void this.instance.commands.viewport.zoomBy(appliedFactor, anchor)
    event.preventDefault()
    return true
  }

  reset = (): void => {
    if (!this.viewportPan) return
    const pointerId = this.viewportPan.pointerId
    this.viewportPan = null
    this.unbindPanWindow()
    const container = this.getContainer()
    if (container) {
      try {
        container.releasePointerCapture(pointerId)
      } catch {
        // Ignore pointer release failures when capture is already cleared.
      }
    }
  }

  private canStartViewportPan = (event: PointerEvent) => {
    if (!this.viewportPolicy.panEnabled) return false
    const middleDrag = event.button === 1 || (event.buttons & 4) === 4
    const spacePressed = this.instance.state.read('spacePressed')
    const leftDrag = (event.button === 0 || (event.buttons & 1) === 1) && spacePressed
    return middleDrag || leftDrag
  }

  private endViewportPan = (event: PointerEvent): boolean => {
    const pan = this.viewportPan
    if (!pan || pan.pointerId !== event.pointerId) return false
    this.viewportPan = null
    this.unbindPanWindow()
    const container = this.getContainer()
    if (container) {
      try {
        container.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore pointer release failures when capture is already cleared.
      }
    }
    event.preventDefault()
    return true
  }

  private bindPanWindow = () => {
    if (typeof window === 'undefined') return
    if (this.offPanWindow) return
    const onMove = (event: PointerEvent) => {
      this.onPointerMove(event)
    }
    const onUp = (event: PointerEvent) => {
      this.onPointerUp(event)
    }
    const onCancel = (event: PointerEvent) => {
      this.onPointerCancel(event)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    this.offPanWindow = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }

  private unbindPanWindow = () => {
    this.offPanWindow?.()
    this.offPanWindow = null
  }
}
