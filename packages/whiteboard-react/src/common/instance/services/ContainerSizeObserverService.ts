import type { ContainerRect, ContainerSizeObserverService } from 'types/instance'

const getElementRectSnapshot = (element: Element): ContainerRect => {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

export const createContainerSizeObserverService = (): ContainerSizeObserverService => {
  let observer: ResizeObserver | null = null
  let observedElement: Element | null = null
  let onRectChange: ((rect: ContainerRect) => void) | null = null

  const ensureObserver = () => {
    if (observer || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(() => {
      if (!observedElement) return
      onRectChange?.(getElementRectSnapshot(observedElement))
    })
  }

  const unobserve = (element?: Element) => {
    if (!observedElement) return
    if (element && element !== observedElement) return
    observer?.unobserve(observedElement)
    observedElement = null
    onRectChange = null
  }

  const observe = (element: Element, onRect: (rect: ContainerRect) => void) => {
    if (observedElement === element && onRectChange === onRect) return

    if (observedElement && observedElement !== element) {
      observer?.unobserve(observedElement)
    }

    observedElement = element
    onRectChange = onRect
    onRectChange(getElementRectSnapshot(element))

    if (typeof ResizeObserver === 'undefined') return
    ensureObserver()
    observer?.observe(element)
  }

  const dispose = () => {
    if (observedElement) {
      observer?.unobserve(observedElement)
    }
    observer?.disconnect()
    observer = null
    observedElement = null
    onRectChange = null
  }

  return {
    observe,
    unobserve,
    dispose
  }
}
