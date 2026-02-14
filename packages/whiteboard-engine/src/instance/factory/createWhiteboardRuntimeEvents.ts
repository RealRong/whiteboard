import type { WhiteboardRuntimeNamespace } from '@engine-types/instance'
import type { RefLike } from '@engine-types/ui'

export const createWhiteboardRuntimeEvents = (
  containerRef: RefLike<HTMLDivElement | null>
): WhiteboardRuntimeNamespace['events'] => {
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
