import type { PointerInput } from '@engine-types/common'
import type { ViewportNavigation as ViewportNavigationApi } from '@engine-types/instance/services'
import type { ServiceRuntimeContext } from '../../../contracts'

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startCenterX: number
  startCenterY: number
  startZoom: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class ViewportNavigation implements ViewportNavigationApi {
  private context: ServiceRuntimeContext
  private dragState: DragState | null = null

  constructor(context: ServiceRuntimeContext) {
    this.context = context
  }

  private canStartPan = (pointer: PointerInput) => {
    const isMiddle = pointer.button === 1
    const isSpaceLeft = pointer.button === 0 && this.context.state.read('spacePressed')
    return isMiddle || isSpaceLeft
  }

  startPan: ViewportNavigationApi['startPan'] = ({
    pointer,
    enablePan
  }) => {
    if (!enablePan) return false
    if (!this.canStartPan(pointer)) return false

    const viewport = this.context.runtime.viewport.get()
    this.dragState = {
      pointerId: pointer.pointerId,
      startX: pointer.client.x,
      startY: pointer.client.y,
      startCenterX: viewport.center.x,
      startCenterY: viewport.center.y,
      startZoom: viewport.zoom
    }

    return true
  }

  updatePan: ViewportNavigationApi['updatePan'] = ({ pointer }) => {
    const drag = this.dragState
    if (!drag || drag.pointerId !== pointer.pointerId) return

    const dx = pointer.client.x - drag.startX
    const dy = pointer.client.y - drag.startY

    void this.context.setViewport({
      center: {
        x: drag.startCenterX - dx / drag.startZoom,
        y: drag.startCenterY - dy / drag.startZoom
      },
      zoom: drag.startZoom
    })
  }

  endPan: ViewportNavigationApi['endPan'] = ({ pointerId }) => {
    const drag = this.dragState
    if (!drag || drag.pointerId !== pointerId) return false
    this.dragState = null
    return true
  }

  applyWheelZoom: ViewportNavigationApi['applyWheelZoom'] = ({
    clientX,
    clientY,
    deltaY,
    enableWheel,
    minZoom,
    maxZoom,
    wheelSensitivity
  }) => {
    if (!enableWheel) return false

    const zoom = this.context.runtime.viewport.getZoom()
    const anchor = this.context.runtime.viewport.clientToWorld(clientX, clientY)
    const factor = Math.exp(-deltaY * wheelSensitivity)
    const nextZoom = clamp(zoom * factor, minZoom, maxZoom)
    const appliedFactor = nextZoom / zoom
    if (appliedFactor === 1) return false

    void this.context.zoomViewportBy(appliedFactor, anchor)
    return true
  }

  dispose: ViewportNavigationApi['dispose'] = () => {
    this.dragState = null
  }
}
