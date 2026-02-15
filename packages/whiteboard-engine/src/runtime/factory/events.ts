import type { Runtime } from '@engine-types/instance'
import type { RefLike } from '@engine-types/ui'

export const createEvents = (
  containerRef: RefLike<HTMLDivElement | null>
): Runtime['events'] => {
  return {
    onWindow: (type, listener, options) => {
      window.addEventListener(type, listener as EventListener, options)
      return () => {
        window.removeEventListener(type, listener as EventListener, options)
      }
    },
    onContainer: (type, listener, options) => {
      const container = containerRef.current
      if (!container) return () => {}
      container.addEventListener(type, listener as EventListener, options)
      return () => {
        container.removeEventListener(type, listener as EventListener, options)
      }
    }
  }
}
