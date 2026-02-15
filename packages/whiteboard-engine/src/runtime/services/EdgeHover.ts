import type { WhiteboardInstance } from '@engine-types/instance'
import type { EdgeHoverService as EdgeHoverServiceApi } from '@engine-types/instance/services'

type ClientPoint = {
  x: number
  y: number
}

export class EdgeHoverService implements EdgeHoverServiceApi {
  private instance: WhiteboardInstance
  private hoverPoint: ClientPoint | null = null
  private rafId: number | null = null

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
  }

  private flushHover = () => {
    this.rafId = null
    const point = this.hoverPoint
    if (!point) return
    this.hoverPoint = null
    this.instance.commands.edgeConnect.updateHoverAtClient(point.x, point.y)
  }

  cancel: EdgeHoverServiceApi['cancel'] = () => {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.hoverPoint = null
  }

  onPointerMove: EdgeHoverServiceApi['onPointerMove'] = ({ clientX, clientY, enabled }) => {
    if (!enabled) {
      this.cancel()
      return
    }

    this.hoverPoint = { x: clientX, y: clientY }
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.flushHover)
    }
  }

  dispose: EdgeHoverServiceApi['dispose'] = () => {
    this.cancel()
  }
}
