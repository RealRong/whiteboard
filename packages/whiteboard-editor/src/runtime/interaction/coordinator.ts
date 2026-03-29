import {
  createDerivedStore,
  createValueStore
} from '@whiteboard/engine'
import type {
  ActiveInteractionMode,
  InteractionState,
  InteractionCoordinator,
  InteractionSession,
  InteractionSessionInput
} from './types'
import type { ViewportInputRuntime } from '../viewport'
import { createAutoPan } from './autoPan'
import type { PointerContinuation } from '../host/pointerContinuation'
import type { DocumentSelectionLock } from '../host/selectionLock'

type ActiveInteraction = Readonly<{
  id: number
  mode: ActiveInteractionMode
  pointerId?: number
  chrome?: boolean
}>

export const createInteractionCoordinator = ({
  getViewport,
  pointerContinuation,
  selectionLock
}: {
  getViewport: () => Pick<ViewportInputRuntime, 'panScreenBy' | 'screenPoint' | 'size'> | null
  pointerContinuation: PointerContinuation
  selectionLock: DocumentSelectionLock
}): InteractionCoordinator => {
  const active = createValueStore<ActiveInteraction | null>(null)
  const space = createValueStore(false)
  const busy = createDerivedStore({
    get: (read) => read(active) !== null
  })
  const mode = createDerivedStore({
    get: (read) => read(active)?.mode ?? 'idle'
  })
  const chrome = createDerivedStore({
    get: (read) => {
      const current = read(active)
      return current === null
        || (current.mode === 'press' && Boolean(current.chrome))
    }
  })
  const state = createDerivedStore<InteractionState>({
    get: (read) => ({
      busy: read(busy),
      chrome: read(chrome),
      mode: read(mode),
      space: read(space)
    }),
    isEqual: (left, right) => (
      left.busy === right.busy
      && left.chrome === right.chrome
      && left.mode === right.mode
      && left.space === right.space
    )
  })
  let nextId = 1
  let stopPointerContinuation = () => {}
  let releaseDocumentSelection = () => {}
  let endCurrent: (() => void) | null = null
  let currentInput: InteractionSessionInput | null = null
  let currentSession: InteractionSession | null = null
  const autoPan = createAutoPan({
    getViewport
  })

  const clearPointerContinuation = () => {
    stopPointerContinuation()
    stopPointerContinuation = () => {}
  }

  const clearDocumentSelection = () => {
    releaseDocumentSelection()
    releaseDocumentSelection = () => {}
  }

  const matchesPointer = (
    input: InteractionSessionInput,
    event: PointerEvent
  ) => input.pointerId === undefined || event.pointerId === input.pointerId

  const finish = (
    input: InteractionSessionInput,
    current: ActiveInteraction,
    cleanup?: () => void
  ) => {
    if (active.get()?.id !== current.id) {
      return
    }

    autoPan.stop()
    clearPointerContinuation()
    clearDocumentSelection()
    active.set(null)
    endCurrent = null
    currentInput = null
    currentSession = null
    cleanup?.()
  }

  const startSession = (
    input: InteractionSessionInput
  ): InteractionSession | null => {
    if (active.get()) {
      return null
    }

    const current: ActiveInteraction = {
      id: nextId++,
      mode: input.mode,
      pointerId: input.pointerId,
      chrome: input.chrome
    }
    let done = false

    const end = () => {
      if (done) {
        return
      }
      done = true
      finish(input, current, input.cleanup)
    }

    const replace = (
      nextInput: InteractionSessionInput
    ) => {
      if (done || active.get()?.id !== current.id) {
        return null
      }

      done = true
      finish(input, current, input.cleanup)
      return startSession(nextInput)
    }

    const session: InteractionSession = {
      finish: end,
      cancel: end,
      pan: (pointer) => {
        autoPan.update(pointer)
      },
      replace
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

    active.set(current)
    endCurrent = end
    currentInput = input
    currentSession = session
    stopPointerContinuation = pointerContinuation.start({
      pointerId: input.pointerId,
      capture: input.capture,
      move: onPointerMove,
      up: onPointerUp,
      cancel: onPointerCancel
    })
    releaseDocumentSelection = selectionLock.lock()

    if (input.pan) {
      autoPan.start(input.pan, session)
    }

    return session
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
    busy,
    chrome,
    state,
    space,
    start: startSession,
    cancel: () => {
      endCurrent?.()
    },
    handleKeyDown,
    handleKeyUp,
    handleBlur
  }
}
