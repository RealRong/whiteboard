import { createValueStore } from '@whiteboard/core/runtime'
import type {
  InteractionCoordinator,
  InteractionMode,
  InteractionToken
} from './types'

export const createInteractionCoordinator = (): InteractionCoordinator => {
  const mode = createValueStore<InteractionMode>('idle')
  let active: {
    token: InteractionToken
    cancel: () => void
  } | null = null

  return {
    mode,
    tryStart: (kind, cancel) => {
      if (active) {
        return null
      }

      const token: InteractionToken = { kind }
      active = {
        token,
        cancel
      }
      mode.set(kind)
      return token
    },
    finish: (token) => {
      if (active?.token !== token) {
        return
      }

      active = null
      mode.set('idle')
    },
    clear: () => {
      active?.cancel()
    }
  }
}
