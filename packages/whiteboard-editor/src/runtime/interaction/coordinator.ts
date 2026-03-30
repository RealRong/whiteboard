import {
  createDerivedStore,
  createValueStore
} from '@whiteboard/engine'
import type {
  ActiveInteractionMode,
  InteractionActivation,
  InteractionContext,
  InteractionCoordinator,
  InteractionKeyboardInput,
  InteractionPointerInput,
  InteractionRegistration,
  InteractionState,
  RuntimeSession
} from '../../types/runtime/interaction'
import type { ViewportInputRuntime } from '../viewport'
import { createAutoPan } from './autoPan'

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

  return typeof input.pointerId === 'number'
    ? input.pointerId
    : undefined
}

export const createInteractionCoordinator = ({
  getViewport
}: {
  getViewport: () => Pick<ViewportInputRuntime, 'panScreenBy' | 'screenPoint' | 'size'> | null
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
  let current: RunningInteraction | null = null
  let currentSession: RuntimeSession | null = null
  const autoPan = createAutoPan({
    getViewport
  })

  const matchesPointer = (
    pointerId: number | undefined,
    input: {
      pointerId: number
    }
  ) => pointerId === undefined || input.pointerId === pointerId

  const cleanup = (
    running: RunningInteraction
  ) => {
    autoPan.stop()
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

    active.set({
      id: running.id,
      key: running.key,
      mode: running.mode,
      pointerId: running.pointerId,
      chrome: running.chrome
    })
    current = running
    currentSession = session

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

  const handlePointerMove = (
    input: InteractionPointerInput
  ) => {
    const running = current
    const session = currentSession
    if (!running || !session || !matchesPointer(running.pointerId, input)) {
      return false
    }

    running.registration.move?.(
      createContext(
        running,
        session
      ),
      input
    )
    return true
  }

  const handlePointerUp = (
    input: InteractionPointerInput
  ) => {
    const running = current
    const session = currentSession
    if (!running || !session || !matchesPointer(running.pointerId, input)) {
      return false
    }

    running.registration.up?.(
      createContext(
        running,
        session
      ),
      input
    )
    return true
  }

  const handlePointerCancel = (
    input: {
      pointerId: number
    }
  ) => {
    const session = currentSession
    if (!current || !session || !matchesPointer(current.pointerId, input)) {
      return false
    }

    session.cancel()
    return true
  }

  const handleKeyDown = (
    input: InteractionKeyboardInput
  ) => {
    let handled = false

    if (input.code === 'Space') {
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
      input
    )

    if (active.get() && input.key === 'Escape') {
      session.cancel()
    }

    return true
  }

  const handleKeyUp = (
    input: InteractionKeyboardInput
  ) => {
    let handled = false

    if (input.code === 'Space') {
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
      input
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
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    cancel: () => {
      currentSession?.cancel()
    },
    handleKeyDown,
    handleKeyUp,
    handleBlur
  }
}
