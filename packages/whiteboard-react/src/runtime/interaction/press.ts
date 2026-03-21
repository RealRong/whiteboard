import type {
  InteractionCoordinator,
  InteractionSession
} from './types'

export type PressStartInput = {
  pointerId: number
  capture: Element
  start: {
    clientX: number
    clientY: number
  }
  threshold?: number
  holdDelay?: number
  onHold?: () => void
  onTap?: (event: PointerEvent) => void
  onDragStart?: (
    event: PointerEvent,
    state: {
      held: boolean
    }
  ) => void
  onCleanup?: () => void
}

export type PressRuntime = {
  start: (input: PressStartInput) => InteractionSession | null
  cancel: () => void
}

export const createPressRuntime = (
  interaction: InteractionCoordinator
): PressRuntime => {
  let session: InteractionSession | null = null
  let current: PressStartInput | null = null
  let holdTimer: number | null = null
  let held = false

  const clearHoldTimer = () => {
    if (holdTimer === null || typeof window === 'undefined') {
      return
    }

    window.clearTimeout(holdTimer)
    holdTimer = null
  }

  const clear = () => {
    clearHoldTimer()
    const cleanup = current?.onCleanup
    session = null
    current = null
    held = false
    cleanup?.()
  }

  return {
    start: (input) => {
      if (session || interaction.mode.get() !== 'idle') {
        return null
      }

      const threshold = Math.max(1, input.threshold ?? 1)
      const nextSession = interaction.start({
        mode: 'press',
        pointerId: input.pointerId,
        capture: input.capture,
        cleanup: clear,
        move: (event, currentSession) => {
          const active = current
          if (!active) {
            return
          }

          const dx = Math.abs(event.clientX - active.start.clientX)
          const dy = Math.abs(event.clientY - active.start.clientY)
          if (dx < threshold && dy < threshold) {
            return
          }

          currentSession.finish()
          active.onDragStart?.(event, {
            held
          })
        },
        up: (event, currentSession) => {
          const active = current
          if (!active) {
            return
          }

          if (!held) {
            active.onTap?.(event)
          }

          currentSession.finish()
        }
      })
      if (!nextSession) {
        return null
      }

      session = nextSession
      current = input

      if (
        input.holdDelay !== undefined
        && input.onHold
        && typeof window !== 'undefined'
      ) {
        holdTimer = window.setTimeout(() => {
          if (current !== input) {
            return
          }

          held = true
          input.onHold?.()
        }, input.holdDelay)
      }

      return nextSession
    },
    cancel: () => {
      session?.cancel()
    }
  }
}
