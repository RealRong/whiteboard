import type { RefLike } from '@engine-types/ui'
import { bindContainer } from './bindContainer'
import { bindWindow } from './bindWindow'

export type DomBindings = {
  onWindow: <K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => () => void
  onContainer: <K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => () => void
}

export const createDomBindings = (
  containerRef: RefLike<HTMLDivElement | null>
): DomBindings => {
  return {
    onWindow: (type, listener, options) => bindWindow(type, listener, options),
    onContainer: (type, listener, options) =>
      bindContainer(containerRef, type, listener, options)
  }
}
