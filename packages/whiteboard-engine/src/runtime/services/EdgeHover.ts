import type { Instance } from '@engine-types/instance'
import type { EdgeHover as EdgeHoverApi } from '@engine-types/instance/services'

type ClientPoint = {
  x: number
  y: number
}

export class EdgeHover implements EdgeHoverApi {
  private instance: Instance
  private hoverPoint: ClientPoint | null = null
  private rafId: number | null = null

  constructor(instance: Instance) {
    this.instance = instance
  }

  private flushHover = () => {
    this.rafId = null
    const point = this.hoverPoint
    if (!point) return
    this.hoverPoint = null
    this.instance.commands.edgeConnect.updateHoverAtClient(point.x, point.y)
  }

  cancel: EdgeHoverApi['cancel'] = () => {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.hoverPoint = null
  }

  onPointerMove: EdgeHoverApi['onPointerMove'] = ({ clientX, clientY, enabled }) => {
    if (!enabled) {
      this.cancel()
      return
    }

    this.hoverPoint = { x: clientX, y: clientY }
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.flushHover)
    }
  }

  dispose: EdgeHoverApi['dispose'] = () => {
    this.cancel()
  }
}
