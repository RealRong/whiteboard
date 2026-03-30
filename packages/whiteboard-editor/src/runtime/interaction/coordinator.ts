import {
  createDerivedStore,
  createValueStore
} from '@whiteboard/engine'
import type { Point } from '@whiteboard/core/types'
import type {
  ActiveInteractionMode,
  InteractionActivation,
  InteractionContext,
  InteractionCoordinator,
  InteractionPointerInput,
  InteractionRegistration,
  InteractionState,
  RuntimeSession
} from './types'
import type {
  ViewportInputRuntime,
  ViewportPointer
} from '../viewport'
import { createAutoPan } from './autoPan'
import type { PointerContinuation } from '../platform/pointerContinuation'
import type { DocumentSelectionLock } from '../platform/selectionLock'

type ActiveInteraction = Readonly<{
  id: number
  key: string
  mode: ActiveInteractionMode
  pointerId?: number
  chrome?: boolean
}>

type RunningInteraction = {
  id: number
  key: string
  mode: ActiveInteractionMode
  pointerId?: number
  chrome?: boolean
  registration: InteractionRegistration<any, any>
  input: any
  state: any
}

const isRecord = (
  value: unknown
): value is Record<string, unknown> => (
  typeof value === 'object'
  && value !== null
)

const readDefaultPointerId = (
  input: unknown
) => {
  if (!isRecord(input)) {
    return undefined
  }

  if (typeof input.pointerId === 'number') {
    return input.pointerId
  }

  const event = input.event
  return event instanceof PointerEvent
    ? event.pointerId
    : undefined
}

const readDefaultCapture = (
  input: unknown
): Element | null => {
  if (!isRecord(input)) {
    return null
  }

  if (input.capture instanceof Element) {
    return input.capture
  }

  const event = input.event
  if (
    event instanceof PointerEvent
    && event.currentTarget instanceof Element
  ) {
    return event.currentTarget
  }

  return null
}

const toInteractionPointerInput = (
  event: PointerEvent,
  point: ViewportPointer
): InteractionPointerInput => ({
  pointerId: event.pointerId,
  client: {
    x: event.clientX,
    y: event.clientY
  },
  screen: point.screen,
  world: point.world,
  altKey: event.altKey,
  shiftKey: event.shiftKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  buttons: event.buttons,
  raw: event
})

export const createInteractionCoordinator = ({
  getViewport,
  readPointer,
  pointerContinuation,
  selectionLock
}: {
  getViewport: () => Pick<ViewportInputRuntime, 'panScreenBy' | 'screenPoint' | 'size'> | null
  readPointer: (input: {
    clientX: number
    clientY: number
  }) => ViewportPointer
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
  let current: RunningInteraction | null = null
  let currentSession: RuntimeSession | null = null
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
    pointerId: number | undefined,
    event: PointerEvent
  ) => pointerId === undefined || event.pointerId === pointerId

  const cleanup = (
    running: RunningInteraction
  ) => {
    autoPan.stop()
    clearPointerContinuation()
    clearDocumentSelection()
    active.set(null)
    current = null
    currentSession = null
    running.registration.cleanup?.({
      input: running.input,
      state: running.state
    })
  }

  const createContext = <
    State,
    Start
  >(
    running: RunningInteraction & {
      state: State
      input: Start
      registration: InteractionRegistration<State, Start>
    },
    session: RuntimeSession
  ): InteractionContext<State, Start> => ({
    input: running.input,
    state: running.state,
    setState: (next) => {
      running.state = next
    },
    session
  })

  const start = <
    State,
    Start
  >(
    activation: InteractionActivation<State, Start>
  ): RuntimeSession | null => {
    if (active.get()) {
      return null
    }

    const running: RunningInteraction = {
      id: nextId++,
      key: activation.registration.key,
      mode: activation.registration.mode,
      pointerId: readDefaultPointerId(activation.input),
      chrome: activation.registration.chrome?.(activation.state, activation.input),
      registration: activation.registration,
      input: activation.input,
      state: activation.state
    }
    let done = false

    const finish = () => {
      if (done || active.get()?.id !== running.id) {
        return
      }

      done = true
      cleanup(running)
    }

    const cancel = () => {
      if (done || active.get()?.id !== running.id) {
        return
      }

      const session = currentSession
      if (!session) {
        done = true
        cleanup(running)
        return
      }

      running.registration.cancel?.(
        createContext(
          running as RunningInteraction & {
            state: State
            input: Start
            registration: InteractionRegistration<State, Start>
          },
          session
        )
      )

      if (done || active.get()?.id !== running.id) {
        return
      }

      done = true
      cleanup(running)
    }

    const replace: RuntimeSession['replace'] = (nextActivation) => {
      if (done || active.get()?.id !== running.id) {
        return false
      }

      done = true
      cleanup(running)
      return Boolean(start(nextActivation))
    }

    const session: RuntimeSession = {
      finish,
      cancel,
      pan: (pointer) => {
        autoPan.update(pointer)
      },
      replace
    }

    const handleMove = (
      event: PointerEvent
    ) => {
      if (!matchesPointer(running.pointerId, event) || !currentSession) {
        return
      }

      const activeInteraction = current
      if (
        !activeInteraction
        || activeInteraction.id !== running.id
      ) {
        return
      }

      activeInteraction.registration.move?.(
        createContext(
          activeInteraction as RunningInteraction & {
            state: State
            input: Start
            registration: InteractionRegistration<State, Start>
          },
          currentSession as RuntimeSession
        ),
        toInteractionPointerInput(event, readPointer(event))
      )
    }

    const handleUp = (
      event: PointerEvent
    ) => {
      if (!matchesPointer(running.pointerId, event) || !currentSession) {
        return
      }

      const activeInteraction = current
      if (
        !activeInteraction
        || activeInteraction.id !== running.id
      ) {
        return
      }

      activeInteraction.registration.up?.(
        createContext(
          activeInteraction as RunningInteraction & {
            state: State
            input: Start
            registration: InteractionRegistration<State, Start>
          },
          currentSession as RuntimeSession
        ),
        toInteractionPointerInput(event, readPointer(event))
      )
    }

    const handlePointerCancel = (
      event: PointerEvent
    ) => {
      if (!matchesPointer(running.pointerId, event)) {
        return
      }

      session.cancel()
    }

    active.set({
      id: running.id,
      key: running.key,
      mode: running.mode,
      pointerId: running.pointerId,
      chrome: running.chrome
    })
    current = running
    currentSession = session
    stopPointerContinuation = pointerContinuation.start({
      pointerId: running.pointerId,
      capture: activation.registration.capture?.(activation.state, activation.input)
        ?? readDefaultCapture(activation.input),
      move: handleMove,
      up: handleUp,
      cancel: handlePointerCancel
    })
    releaseDocumentSelection = selectionLock.lock()

    const panOptions = typeof activation.registration.pan === 'function'
      ? activation.registration.pan(activation.state, activation.input)
      : activation.registration.pan
    if (panOptions) {
      autoPan.start(panOptions, session)
    }

    activation.registration.start?.(
      createContext(
        running as RunningInteraction & {
          state: State
          input: Start
          registration: InteractionRegistration<State, Start>
        },
        session
      )
    )

    return session
  }

  const handleBlur = () => {
    if (space.get()) {
      space.set(false)
    }

    const running = current
    const session = currentSession
    if (!running || !session) {
      return
    }

    if (running.registration.blur) {
      running.registration.blur(
        createContext(
          running,
          session
        )
      )
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

    const running = current
    const session = currentSession
    if (!running || !session) {
      return handled
    }

    handled = true
    running.registration.keydown?.(
      createContext(
        running,
        session
      ),
      event
    )

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

    const running = current
    const session = currentSession
    if (!running || !session) {
      return handled
    }

    running.registration.keyup?.(
      createContext(
        running,
        session
      ),
      event
    )
    return true
  }

  return {
    mode,
    busy,
    chrome,
    state,
    space,
    start,
    cancel: () => {
      currentSession?.cancel()
    },
    handleKeyDown,
    handleKeyUp,
    handleBlur
  }
}
