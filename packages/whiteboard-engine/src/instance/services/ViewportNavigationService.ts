import type { WhiteboardInstance } from '@engine-types/instance'
import type { ViewportNavigationService as ViewportNavigationServiceApi } from '@engine-types/instance/services'

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startCenterX: number
  startCenterY: number
  startZoom: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class ViewportNavigationService implements ViewportNavigationServiceApi {
  private instance: WhiteboardInstance
  private dragState: DragState | null = null

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
  }

  startPan: ViewportNavigationServiceApi['startPan'] = ({
    pointerId,
    button,
    clientX,
    clientY,
    spacePressed,
    enablePan
  }) => {
    if (!enablePan) return false
    const isMiddle = button === 1
    const isSpaceLeft = button === 0 && spacePressed
    if (!isMiddle && !isSpaceLeft) return false

    const viewport = this.instance.runtime.viewport.get()
    this.dragState = {
      pointerId,
      startX: clientX,
      startY: clientY,
      startCenterX: viewport.center.x,
      startCenterY: viewport.center.y,
      startZoom: viewport.zoom
    }

    return true
  }

  updatePan: ViewportNavigationServiceApi['updatePan'] = ({ pointerId, clientX, clientY }) => {
    const drag = this.dragState
    if (!drag || drag.pointerId !== pointerId) return

    const dx = clientX - drag.startX
    const dy = clientY - drag.startY

    void this.instance.commands.viewport.set({
      center: {
        x: drag.startCenterX - dx / drag.startZoom,
        y: drag.startCenterY - dy / drag.startZoom
      },
      zoom: drag.startZoom
    })
  }

  endPan: ViewportNavigationServiceApi['endPan'] = ({ pointerId }) => {
    const drag = this.dragState
    if (!drag || drag.pointerId !== pointerId) return false
    this.dragState = null
    return true
  }

  applyWheelZoom: ViewportNavigationServiceApi['applyWheelZoom'] = ({
    clientX,
    clientY,
    deltaY,
    enableWheel,
    minZoom,
    maxZoom,
    wheelSensitivity
  }) => {
    if (!enableWheel) return false

    const zoom = this.instance.runtime.viewport.getZoom()
    const anchor = this.instance.runtime.viewport.clientToWorld(clientX, clientY)
    const factor = Math.exp(-deltaY * wheelSensitivity)
    const nextZoom = clamp(zoom * factor, minZoom, maxZoom)
    const appliedFactor = nextZoom / zoom
    if (appliedFactor === 1) return false

    void this.instance.commands.viewport.zoomBy(appliedFactor, anchor)
    return true
  }

  dispose: ViewportNavigationServiceApi['dispose'] = () => {
    this.dragState = null
  }
}
