import {
  createDerivedStore,
  createValueStore
} from '@whiteboard/engine'
import type {
  InteractionControl,
  InteractionKeyboardInput,
  InteractionOwner,
  InteractionRuntime,
  InteractionSession,
  InteractionSessionMode,
  InteractionState
} from './types'
import type {
  PointerDownInput,
  PointerMoveInput,
  PointerUpInput,
  WheelInput
} from '@whiteboard/editor'
import { createAutoPan } from './autoPan'

type SessionMeta = Readonly<{
  id: number
  key: string
  mode: InteractionSessionMode
  pointerId?: number
  chrome?: boolean
}>

type RunningSession = {
  id: number
  key: string
  pointerId?: number
  session: InteractionSession
}

const byPriorityDesc = (
  left: InteractionOwner,
  right: InteractionOwner
) => (right.priority ?? 0) - (left.priority ?? 0)

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

export const createInteractionRuntime = ({
  getViewport,
  getOwners,
  space
}: {
  getViewport: () => {
    panScreenBy: (deltaScreen: {
      x: number
      y: number
    }) => void
    screenPoint: (clientX: number, clientY: number) => {
      x: number
      y: number
    }
    size: () => {
      width: number
      height: number
    }
  } | null
  getOwners: () => readonly InteractionOwner[]
  space: {
    get: () => boolean
    set: (value: boolean) => void
  }
}): InteractionRuntime => {
  const active = createValueStore<SessionMeta | null>(null)
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
        || Boolean(current.chrome)
    }
  })
  const state = createDerivedStore<InteractionState>({
    get: (read) => ({
      busy: read(busy),
      chrome: read(chrome),
      mode: read(mode),
      transforming: read(mode) === 'node-transform'
    }),
    isEqual: (left, right) => (
      left.busy === right.busy
      && left.chrome === right.chrome
      && left.mode === right.mode
      && left.transforming === right.transforming
    )
  })
  let nextId = 1
  let current: RunningSession | null = null
  let currentControl: InteractionControl | null = null
  const autoPan = createAutoPan({
    getViewport
  })

  const readOrderedOwners = () => [...getOwners()].sort(byPriorityDesc)

  const matchesPointer = (
    pointerId: number | undefined,
    input: {
      pointerId: number
    }
  ) => pointerId === undefined || input.pointerId === pointerId

  const syncActive = (running: RunningSession | null) => {
    if (!running) {
      active.set(null)
      return
    }

    active.set({
      id: running.id,
      key: running.key,
      mode: running.session.mode,
      pointerId: running.pointerId,
      chrome: running.session.chrome
    })
  }

  const cleanup = (running: RunningSession) => {
    autoPan.stop()
    current = null
    currentControl = null
    syncActive(null)
    running.session.cleanup?.()
  }

  const observeCancel = () => {
    readOrderedOwners().forEach((owner) => {
      owner.observe?.cancel?.()
    })
  }

  const observeLeave = () => {
    readOrderedOwners().forEach((owner) => {
      owner.observe?.leave?.()
    })
  }

  const observeBlur = () => {
    readOrderedOwners().forEach((owner) => {
      owner.observe?.blur?.()
    })
  }

  const observeMove = (
    input: PointerMoveInput
  ) => {
    readOrderedOwners().forEach((owner) => {
      owner.observe?.move?.(input)
    })
  }

  const observeWheel = (
    input: WheelInput
  ) => {
    let handled = false

    readOrderedOwners().forEach((owner) => {
      handled = owner.observe?.wheel?.(input) || handled
    })

    return handled
  }

  const cancel = () => {
    observeCancel()
    currentControl?.cancel()
  }

  const handlePointerDown = (
    input: PointerDownInput
  ) => {
    if (active.get()) {
      return false
    }

    const owners = readOrderedOwners()
    for (let index = 0; index < owners.length; index += 1) {
      const owner = owners[index]
      if (!owner?.start) {
        continue
      }

      const id = nextId++
      let done = false
      let running: RunningSession | null = null
      let pendingResult: 'finish' | 'cancel' | null = null
      let pendingMode: InteractionSessionMode | undefined
      let pendingChrome: boolean | undefined

      const finish = () => {
        if (!running) {
          pendingResult = 'finish'
          return
        }

        if (done || active.get()?.id !== id || !running) {
          return
        }

        done = true
        cleanup(running)
      }

      const cancelCurrent = () => {
        if (!running) {
          pendingResult = 'cancel'
          return
        }

        if (done || active.get()?.id !== id || !running) {
          return
        }

        running.session.cancel?.()
        if (done || active.get()?.id !== id || !running) {
          return
        }

        done = true
        cleanup(running)
      }

      const control: InteractionControl = {
        finish,
        cancel: cancelCurrent,
        pan: (pointer) => {
          autoPan.update(pointer)
        },
        update: (next) => {
          if (!running) {
            if (next.mode !== undefined) {
              pendingMode = next.mode
            }

            if (next.chrome !== undefined) {
              pendingChrome = next.chrome
            }
            return
          }

          if (done || active.get()?.id !== id || !running) {
            return
          }

          running.session = {
            ...running.session,
            mode: next.mode ?? running.session.mode,
            chrome:
              next.chrome === undefined
                ? running.session.chrome
                : next.chrome
          }
          syncActive(running)
        }
      }

      const startResult = owner.start(input, control)
      if (!startResult) {
        continue
      }

      if (startResult.kind === 'handled') {
        return true
      }

      const nextSession = startResult.session

      const resolvedSession: InteractionSession = {
        ...nextSession,
        mode: pendingMode ?? nextSession.mode,
        chrome:
          pendingChrome === undefined
            ? nextSession.chrome
            : pendingChrome
      }

      running = {
        id,
        key: owner.key,
        pointerId: resolvedSession.pointerId ?? readDefaultPointerId(input),
        session: resolvedSession
      }

      if (pendingResult === 'cancel') {
        resolvedSession.cancel?.()
        resolvedSession.cleanup?.()
        return true
      }

      if (pendingResult === 'finish') {
        resolvedSession.cleanup?.()
        return true
      }

      current = running
      currentControl = control
      syncActive(running)
      observeCancel()

      if (resolvedSession.autoPan) {
        autoPan.start(resolvedSession.autoPan)
      }

      return true
    }

    return false
  }

  const handlePointerMove = (
    input: PointerMoveInput
  ) => {
    const running = current
    if (running) {
      if (!matchesPointer(running.pointerId, input)) {
        return false
      }

      running.session.move?.(input)
      return true
    }

    observeMove(input)
    return false
  }

  const handlePointerUp = (
    input: PointerUpInput
  ) => {
    const running = current
    if (!running || !matchesPointer(running.pointerId, input)) {
      return false
    }

    running.session.up?.(input)
    return true
  }

  const handlePointerCancel = (
    input: {
      pointerId: number
    }
  ) => {
    observeCancel()

    if (!current || !matchesPointer(current.pointerId, input)) {
      return false
    }

    currentControl?.cancel()
    return true
  }

  const handlePointerLeave = () => {
    observeLeave()
  }

  const handleWheel = (
    input: WheelInput
  ) => {
    if (current) {
      return true
    }

    return observeWheel(input)
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
    if (!running) {
      return handled
    }

    running.session.keydown?.(input)

    if (active.get() && input.key === 'Escape') {
      cancel()
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
    if (!running) {
      return handled
    }

    running.session.keyup?.(input)
    return true
  }

  const handleBlur = () => {
    if (space.get()) {
      space.set(false)
    }

    observeBlur()

    const running = current
    if (!running) {
      return
    }

    if (running.session.blur) {
      running.session.blur()
      return
    }

    cancel()
  }

  return {
    mode,
    busy,
    chrome,
    state,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
    handleWheel,
    cancel,
    handleKeyDown,
    handleKeyUp,
    handleBlur
  }
}
