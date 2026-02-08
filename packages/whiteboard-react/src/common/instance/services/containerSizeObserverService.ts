import type { Size } from 'types/common'
import type { ContainerSizeObserverService } from 'types/instance'


export const createContainerSizeObserverService = (): ContainerSizeObserverService => {
  let observer: ResizeObserver | null = null
  let observedElement: Element | null = null
  let onSizeChange: ((size: Size) => void) | null = null

  const emit = (width: number, height: number) => {
    onSizeChange?.({ width, height })
  }

  const ensureObserver = () => {
    if (observer || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      emit(width, height)
    })
  }

  const unobserve = (element?: Element) => {
    if (!observedElement) return
    if (element && element !== observedElement) return
    observer?.unobserve(observedElement)
    observedElement = null
    onSizeChange = null
  }

  const observe = (element: Element, onSize: (size: Size) => void) => {
    if (observedElement === element && onSizeChange === onSize) return

    if (observedElement && observedElement !== element) {
      observer?.unobserve(observedElement)
    }

    observedElement = element
    onSizeChange = onSize

    const rect = element.getBoundingClientRect()
    emit(rect.width, rect.height)

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
    onSizeChange = null
  }

  return {
    observe,
    unobserve,
    dispose
  }
}
