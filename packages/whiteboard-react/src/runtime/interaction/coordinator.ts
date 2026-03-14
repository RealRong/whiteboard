import { createSignal } from './signal'
import type {
  ActiveInteractionSessionKind,
  InteractionCoordinator,
  InteractionToken
} from './types'

export const createInteractionCoordinator = (): InteractionCoordinator => {
  const session = createSignal<{ kind: 'idle' | ActiveInteractionSessionKind }>({
    kind: 'idle'
  })
  let active: {
    token: InteractionToken
    cancel: () => void
  } | null = null

  return {
    session,
    tryStart: (kind, cancel) => {
      if (active) {
        return null
      }

      const token: InteractionToken = { kind }
      active = {
        token,
        cancel
      }
      session.set({ kind })
      return token
    },
    finish: (token) => {
      if (active?.token !== token) {
        return
      }

      active = null
      session.set({ kind: 'idle' })
    },
    clear: () => {
      active?.cancel()
    }
  }
}
