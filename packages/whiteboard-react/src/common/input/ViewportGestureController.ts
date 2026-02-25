import type { Instance } from '@whiteboard/engine'
import {
  isSameViewport,
  panViewport,
  viewportScreenToWorld,
  zoomViewport
} from '@whiteboard/core/geometry'
import type { Viewport } from '@whiteboard/core/types'

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
  viewport: Viewport
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const WHEEL_SETTLE_MS = 96

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

export class ViewportGestureController {
  private readonly instance: Instance
  private readonly viewportPolicy: ViewportPolicy
  private readonly getContainer: () => HTMLDivElement | null
  private viewportPan: ViewportPanState | null = null
  private wheelCommitTimer: ReturnType<typeof setTimeout> | null = null
  private pendingWheelViewport: Viewport | null = null
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
    this.cancelWheelCommit()
    const viewport = this.readGestureViewport()
    this.viewportPan = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      viewport
    }
    this.writeViewportPreview(viewport)
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
    const zoom = pan.viewport.zoom
    if (!Number.isFinite(zoom) || zoom <= 0) return true
    const deltaX = event.clientX - pan.lastX
    const deltaY = event.clientY - pan.lastY
    if (deltaX === 0 && deltaY === 0) return true
    pan.lastX = event.clientX
    pan.lastY = event.clientY
    pan.viewport = panViewport(pan.viewport, {
      x: -deltaX / zoom,
      y: -deltaY / zoom
    })
    this.writeViewportPreview(pan.viewport)
    event.preventDefault()
    return true
  }

  onPointerUp = (event: PointerEvent): boolean => this.endViewportPan(event)

  onPointerCancel = (event: PointerEvent): boolean => this.endViewportPan(event)

  onWheel = (event: WheelEvent): boolean => {
    if (!this.viewportPolicy.wheelEnabled) return false
    const viewport = this.readGestureViewport()
    const zoom = viewport.zoom
    if (!Number.isFinite(zoom) || zoom <= 0) return false
    const factor = Math.exp(-event.deltaY * this.viewportPolicy.wheelSensitivity)
    const nextZoom = clamp(
      zoom * factor,
      this.viewportPolicy.minZoom,
      this.viewportPolicy.maxZoom
    )
    const appliedFactor = nextZoom / zoom
    if (appliedFactor === 1) return false
    const anchorScreen = this.instance.query.viewport.clientToScreen(
      event.clientX,
      event.clientY
    )
    const anchor = viewportScreenToWorld(
      anchorScreen,
      viewport,
      this.instance.query.viewport.getScreenCenter()
    )
    const nextViewport = zoomViewport(viewport, appliedFactor, anchor)
    this.writeViewportPreview(nextViewport)
    this.scheduleWheelCommit(nextViewport)
    event.preventDefault()
    return true
  }

  reset = (): void => {
    this.cancelWheelCommit()
    this.clearViewportPreview()
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
    const spacePressed = this.instance.render.read('spacePressed')
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
    this.commitViewport(pan.viewport)
    event.preventDefault()
    return true
  }

  private readCommittedViewport = (): Viewport =>
    this.instance.query.viewport.get()

  private readGestureViewport = (): Viewport =>
    this.instance.render.read('viewportGesture').preview ?? this.readCommittedViewport()

  private writeViewportPreview = (viewport: Viewport) => {
    this.instance.render.write('viewportGesture', {
      preview: copyViewport(viewport)
    })
  }

  private clearViewportPreview = () => {
    this.instance.render.write('viewportGesture', {})
  }

  private commitViewport = (viewport: Viewport) => {
    const committed = this.readCommittedViewport()
    if (isSameViewport(committed, viewport)) {
      this.clearViewportPreview()
      return
    }
    const target = copyViewport(viewport)
    void this.instance.commands.viewport
      .set(target)
      .finally(() => {
        const preview = this.instance.render.read('viewportGesture').preview
        if (!preview || isSameViewport(preview, target)) {
          this.clearViewportPreview()
        }
      })
  }

  private scheduleWheelCommit = (viewport: Viewport) => {
    this.cancelWheelCommit()
    this.pendingWheelViewport = copyViewport(viewport)
    this.wheelCommitTimer = setTimeout(() => {
      this.wheelCommitTimer = null
      const pending = this.pendingWheelViewport
      this.pendingWheelViewport = null
      if (!pending) return
      this.commitViewport(pending)
    }, WHEEL_SETTLE_MS)
  }

  private cancelWheelCommit = () => {
    this.pendingWheelViewport = null
    if (this.wheelCommitTimer === null) return
    clearTimeout(this.wheelCommitTimer)
    this.wheelCommitTimer = null
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
