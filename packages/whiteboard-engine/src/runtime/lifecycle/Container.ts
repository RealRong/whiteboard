import type { LifecycleRuntimeContext } from '../common/contracts'

type ContainerContext = Pick<LifecycleRuntimeContext, 'runtime'>

type ContainerControllerOptions = {
  context: ContainerContext
}

export class Container {
  private context: ContainerContext
  private observedContainer: HTMLElement | null = null

  constructor(options: ContainerControllerOptions) {
    this.context = options.context
  }

  sync = () => {
    const container = this.context.runtime.containerRef.current
    if (!container) return

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
    if (this.observedContainer) {
      this.context.runtime.services.containerSizeObserver.unobserve(
        this.observedContainer
      )
      this.observedContainer = null
    }
  }
}
