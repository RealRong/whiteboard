import type { RefLike } from '@engine-types/ui'

export const bindContainer = <K extends keyof HTMLElementEventMap>(
  containerRef: RefLike<HTMLDivElement | null>,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
) => {
  const container = containerRef.current
  if (!container) return () => {}

  container.addEventListener(type, listener as EventListener, options)
  return () => {
    container.removeEventListener(type, listener as EventListener, options)
  }
}
