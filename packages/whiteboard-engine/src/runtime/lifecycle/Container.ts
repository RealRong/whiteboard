import type { Instance } from '@engine-types/instance'
import { bindCanvasContainerEvents } from '../bindings'
import type { CanvasEventHandlers } from '../input'

type ContainerControllerOptions = {
  instance: Instance
  getHandlers: () => CanvasEventHandlers
  getOnWheel: () => (event: WheelEvent) => void
}

export class Container {
  private instance: Instance
  private getHandlers: () => CanvasEventHandlers
  private getOnWheel: () => (event: WheelEvent) => void
  private offContainerEvents: (() => void) | null = null
  private observedContainer: HTMLElement | null = null

  constructor(options: ContainerControllerOptions) {
    this.instance = options.instance
    this.getHandlers = options.getHandlers
    this.getOnWheel = options.getOnWheel
  }

  sync = () => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return

    if (!this.offContainerEvents) {
      this.offContainerEvents = bindCanvasContainerEvents({
        events: this.instance.runtime.events,
        handlers: this.getHandlers(),
        onWheel: this.getOnWheel()
      })
    }

    if (this.observedContainer === container) return
    if (this.observedContainer) {
      this.instance.runtime.services.containerSizeObserver.unobserve(this.observedContainer)
    }
    this.instance.runtime.services.containerSizeObserver.observe(container, this.instance.runtime.viewport.setContainerRect)
    this.observedContainer = container
  }

  stop = () => {
    this.offContainerEvents?.()
    this.offContainerEvents = null

    if (this.observedContainer) {
      this.instance.runtime.services.containerSizeObserver.unobserve(this.observedContainer)
      this.observedContainer = null
    }
  }
}
