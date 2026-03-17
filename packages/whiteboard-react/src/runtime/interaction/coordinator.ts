import {
  createDerivedStore,
  createValueStore
} from '@whiteboard/core/runtime'
import type {
  ActiveInteractionMode,
  InteractionCoordinator,
  InteractionSession,
  InteractionStartInput
} from './types'
import type { ViewportInputRuntime } from '../viewport'
import { createAutoPan } from './autoPan'

type ActiveInteraction = Readonly<{
  id: number
  mode: ActiveInteractionMode
  pointerId?: number
}>

export const createInteractionCoordinator = ({
  getViewport
}: {
  getViewport: () => Pick<ViewportInputRuntime, 'panScreenBy' | 'screenPoint' | 'size'> | null
}): InteractionCoordinator => {
  const active = createValueStore<ActiveInteraction | null>(null)
  const space = createValueStore(false)
  const mode = createDerivedStore({
    get: (read) => read(active)?.mode ?? 'idle'
  })
  let nextId = 1
  let releaseWindow = () => {}
  let endCurrent: (() => void) | null = null
  let currentInput: InteractionStartInput | null = null
  let currentSession: InteractionSession | null = null
  const autoPan = createAutoPan({
    getViewport
  })

  const clearWindow = () => {
    releaseWindow()
    releaseWindow = () => {}
  }

  const releaseCapture = (
    target: Element | null | undefined,
    pointerId: number | undefined
  ) => {
    if (!target || pointerId === undefined) {
      return
    }

    const release = (target as Element & {
      releasePointerCapture?: (pointerId: number) => void
    }).releasePointerCapture

    if (typeof release !== 'function') {
      return
    }

    try {
      release.call(target, pointerId)
    } catch {
      // Ignore pointer release failures.
    }
  }

  const capturePointer = (
    target: Element | null | undefined,
    pointerId: number | undefined
  ) => {
    if (!target || pointerId === undefined) {
      return
    }

    const capture = (target as Element & {
      setPointerCapture?: (pointerId: number) => void
    }).setPointerCapture

    if (typeof capture !== 'function') {
      return
    }

    try {
      capture.call(target, pointerId)
    } catch {
      // Ignore pointer capture failures.
    }
  }

  const matchesPointer = (
    input: InteractionStartInput,
    event: PointerEvent
  ) => input.pointerId === undefined || event.pointerId === input.pointerId

  const finish = (
    input: InteractionStartInput,
    current: ActiveInteraction,
    cleanup?: () => void
  ) => {
    if (active.get()?.id !== current.id) {
      return
    }

    autoPan.stop()
    clearWindow()
    releaseCapture(input.capture, current.pointerId)
    active.set(null)
    endCurrent = null
    currentInput = null
    currentSession = null
    cleanup?.()
  }

  const handleBlur = () => {
    if (space.get()) {
      space.set(false)
    }

    const input = currentInput
    const session = currentSession
    if (!input || !session) {
      return
    }

    if (input.blur) {
      input.blur(session)
      return
    }

    session.cancel()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    let handled = false

    if (event.code === 'Space') {
      if (!space.get()) {
        space.set(true)
      }
      handled = true
    }

    const input = currentInput
    const session = currentSession
    if (!input || !session) {
      return handled
    }

    handled = true
    input.keydown?.(event, session)

    if (active.get() && event.key === 'Escape') {
      session.cancel()
    }

    return true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    let handled = false

    if (event.code === 'Space') {
      if (space.get()) {
        space.set(false)
      }
      handled = true
    }

    const input = currentInput
    const session = currentSession
    if (!input || !session) {
      return handled
    }

    input.keyup?.(event, session)
    return true
  }

  return {
    mode,
    space,
    start: (input) => {
      if (active.get()) {
        return null
      }

      const current: ActiveInteraction = {
        id: nextId++,
        mode: input.mode,
        pointerId: input.pointerId
      }
      let done = false

      const end = () => {
        if (done) {
          return
        }
        done = true
        finish(input, current, input.cleanup)
      }

      const session: InteractionSession = {
        finish: end,
        cancel: end,
        pan: (pointer) => {
          autoPan.update(pointer)
        }
      }

      const onPointerMove = (event: PointerEvent) => {
        if (!matchesPointer(input, event)) {
          return
        }
        input.move?.(event, session)
      }

      const onPointerUp = (event: PointerEvent) => {
        if (!matchesPointer(input, event)) {
          return
        }
        input.up?.(event, session)
      }

      const onPointerCancel = (event: PointerEvent) => {
        if (!matchesPointer(input, event)) {
          return
        }
        session.cancel()
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerCancel)

        releaseWindow = () => {
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('pointercancel', onPointerCancel)
        }
      }

      active.set(current)
      endCurrent = end
      currentInput = input
      currentSession = session
      capturePointer(input.capture, input.pointerId)

      if (input.pan) {
        autoPan.start(input.pan, session)
      }

      return session
    },
    cancel: () => {
      endCurrent?.()
    },
    handleKeyDown,
    handleKeyUp,
    handleBlur
  }
}
