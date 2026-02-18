import type { InternalInstance } from '@engine-types/instance/instance'
import type { DomBindings } from '../../host/dom'
import { bindCanvasContainerEvents } from './bindings/canvasContainerEvents'
import type { CanvasEventHandlers } from './input/types'

type ContainerControllerOptions = {
  instance: InternalInstance
  dom: DomBindings
  getHandlers: () => CanvasEventHandlers
  getOnWheel: () => (event: WheelEvent) => void
}

export class Container {
  private instance: InternalInstance
  private dom: DomBindings
  private getHandlers: () => CanvasEventHandlers
  private getOnWheel: () => (event: WheelEvent) => void
  private offContainerEvents: (() => void) | null = null
  private observedContainer: HTMLElement | null = null

  constructor(options: ContainerControllerOptions) {
    this.instance = options.instance
    this.dom = options.dom
    this.getHandlers = options.getHandlers
    this.getOnWheel = options.getOnWheel
  }

  sync = () => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return

    if (!this.offContainerEvents) {
      this.offContainerEvents = bindCanvasContainerEvents({
        dom: this.dom,
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
