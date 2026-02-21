import type {
  ContainerRect,
  ContainerSizeObserver as ContainerSizeObserverApi
} from '@engine-types/instance/services'

const getElementRectSnapshot = (element: Element): ContainerRect => {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

export class ContainerSizeObserver implements ContainerSizeObserverApi {
  private observer: ResizeObserver | null = null
  private observedElement: Element | null = null
  private onRectChange: ((rect: ContainerRect) => void) | null = null

  private ensureObserver = () => {
    if (this.observer || typeof ResizeObserver === 'undefined') return
    this.observer = new ResizeObserver(() => {
      if (!this.observedElement) return
      this.onRectChange?.(getElementRectSnapshot(this.observedElement))
    })
  }

  unobserve = (element?: Element) => {
    if (!this.observedElement) return
    if (element && element !== this.observedElement) return
    this.observer?.unobserve(this.observedElement)
    this.observedElement = null
    this.onRectChange = null
  }

  observe = (element: Element, onRect: (rect: ContainerRect) => void) => {
    if (this.observedElement === element && this.onRectChange === onRect) return

    if (this.observedElement && this.observedElement !== element) {
      this.observer?.unobserve(this.observedElement)
    }

    this.observedElement = element
    this.onRectChange = onRect
    this.onRectChange(getElementRectSnapshot(element))

    if (typeof ResizeObserver === 'undefined') return
    this.ensureObserver()
    this.observer?.observe(element)
  }

  dispose = () => {
    if (this.observedElement) {
      this.observer?.unobserve(this.observedElement)
    }
    this.observer?.disconnect()
    this.observer = null
    this.observedElement = null
    this.onRectChange = null
  }
}
