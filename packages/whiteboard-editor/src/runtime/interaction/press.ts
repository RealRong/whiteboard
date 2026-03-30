import type {
  InteractionCoordinator,
  InteractionSession
} from './types'
import { createInteractionSessionSlot } from './sessionSlot'

export type PressStartInput = {
  pointerId: number
  capture: Element
  chrome?: boolean
  start: {
    clientX: number
    clientY: number
  }
  threshold?: number
  holdDelay?: number
  onHold?: () => void
  onTap?: (event: PointerEvent) => void
  onDragStart?: (event: PointerEvent) => void
}

export type PressRuntime = {
  start: (input: PressStartInput) => InteractionSession | null
  cancel: () => void
}

export const createPressRuntime = (
  interaction: InteractionCoordinator
): PressRuntime => {
  const session = createInteractionSessionSlot<PressStartInput>({
    interaction,
    cleanup: () => {
      clearHoldTimer()
    }
  })
  let holdTimer: number | null = null

  const clearHoldTimer = () => {
    if (holdTimer === null || typeof window === 'undefined') {
      return
    }

    window.clearTimeout(holdTimer)
    holdTimer = null
  }

  return {
    start: (input) => {
      if (session.getSession() || interaction.busy.get()) {
        return null
      }

      const threshold = Math.max(1, input.threshold ?? 1)
      const nextSession = session.start({
        mode: 'press',
        pointerId: input.pointerId,
        capture: input.capture,
        chrome: input.chrome,
        move: (event, currentSession) => {
          const active = session.getActive()
          if (!active) {
            return
          }

          const dx = Math.abs(event.clientX - active.start.clientX)
          const dy = Math.abs(event.clientY - active.start.clientY)
          if (dx < threshold && dy < threshold) {
            return
          }

          const onDragStart = active.onDragStart
          currentSession.finish()
          onDragStart?.(event)
        },
        up: (event, currentSession) => {
          const active = session.getActive()
          if (!active) {
            return
          }

          active.onTap?.(event)
          currentSession.finish()
        }
      })
      if (!nextSession) {
        return null
      }

      session.setActive(input)

      if (
        input.holdDelay !== undefined
        && input.onHold
        && typeof window !== 'undefined'
      ) {
        holdTimer = window.setTimeout(() => {
          if (session.getActive() !== input || !session.getSession()) {
            return
          }

          session.getSession()?.finish()
          input.onHold?.()
        }, input.holdDelay)
      }

      return nextSession
    },
    cancel: () => {
      session.cancel()
    }
  }
}
