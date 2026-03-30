import type {
  InteractionCoordinator,
  InteractionSession,
  InteractionSessionInput
} from './types'

type SessionSlotStartInput = Omit<InteractionSessionInput, 'cleanup'>

export type InteractionSessionSlot<Active> = {
  getActive: () => Active | null
  setActive: (active: Active | null) => void
  hasActive: () => boolean
  getSession: () => InteractionSession | null
  start: (input: SessionSlotStartInput) => InteractionSession | null
  clear: () => void
  cancel: () => void
}

export const createInteractionSessionSlot = <Active,>({
  interaction,
  cleanup
}: {
  interaction: Pick<InteractionCoordinator, 'start'>
  cleanup?: () => void
}): InteractionSessionSlot<Active> => {
  let active: Active | null = null
  let session: InteractionSession | null = null

  const clear = () => {
    active = null
    session = null
    cleanup?.()
  }

  return {
    getActive: () => active,
    setActive: (next) => {
      active = next
    },
    hasActive: () => active !== null,
    getSession: () => session,
    start: (input) => {
      const nextSession = interaction.start({
        ...input,
        cleanup: clear
      })
      if (!nextSession) {
        return null
      }

      session = nextSession
      return nextSession
    },
    clear,
    cancel: () => {
      if (session) {
        session.cancel()
        return
      }

      clear()
    }
  }
}
