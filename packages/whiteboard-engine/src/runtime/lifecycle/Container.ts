import type { LifecycleContext } from '../../context'
import type { DomBindings } from '../../host/dom'
import { bindCanvasContainerEvents } from './dom/sources'
import type { CanvasEventHandlers } from './input/types'

type ContainerContext = Pick<LifecycleContext, 'runtime'>

type ContainerControllerOptions = {
  context: ContainerContext
  dom: DomBindings
  handlers: CanvasEventHandlers
  onWheel: (event: WheelEvent) => void
}

export class Container {
  private context: ContainerContext
  private dom: DomBindings
  private handlers: CanvasEventHandlers
  private onWheel: (event: WheelEvent) => void
  private offContainerEvents: (() => void) | null = null
  private observedContainer: HTMLElement | null = null

  constructor(options: ContainerControllerOptions) {
    this.context = options.context
    this.dom = options.dom
    this.handlers = options.handlers
    this.onWheel = options.onWheel
  }

  sync = () => {
    const container = this.context.runtime.containerRef.current
    if (!container) return

    if (!this.offContainerEvents) {
      this.offContainerEvents = bindCanvasContainerEvents({
        dom: this.dom,
        handlers: this.handlers,
        onWheel: this.onWheel
      })
    }

    if (this.observedContainer === container) return
    if (this.observedContainer) {
      this.context.runtime.services.containerSizeObserver.unobserve(
        this.observedContainer
      )
    }
    this.context.runtime.services.containerSizeObserver.observe(
      container,
      this.context.runtime.viewport.setContainerRect
    )
    this.observedContainer = container
  }

  stop = () => {
    this.offContainerEvents?.()
    this.offContainerEvents = null

    if (this.observedContainer) {
      this.context.runtime.services.containerSizeObserver.unobserve(
        this.observedContainer
      )
      this.observedContainer = null
    }
  }
}
