import {
  createDerivedStore,
  createValueStore
} from '@whiteboard/engine'
import type {
  ActiveInteraction as RunningActiveInteraction,
  ActiveInteractionMode,
  InteractionControl,
  InteractionCoordinator,
  InteractionKeyboardInput,
  InteractionPointerInput,
  InteractionRegistration,
  InteractionState
} from '../../types/runtime/interaction'
import type { PointerDown } from '../input/pointer'
import type { ViewportInputRuntime } from '../viewport'
import { createAutoPan } from './autoPan'

type ActiveInteractionMeta = Readonly<{
  id: number
  key: string
  mode: ActiveInteractionMode
  pointerId?: number
  chrome?: boolean
}>

type RunningInteraction = {
  id: number
  key: string
  pointerId?: number
  active: RunningActiveInteraction
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
  const active = createValueStore<ActiveInteractionMeta | null>(null)
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
        || Boolean(current.chrome)
    }
  })
  const state = createDerivedStore<InteractionState>({
    get: (read) => ({
      busy: read(busy),
      chrome: read(chrome),
      mode: read(mode),
      transforming: read(mode) === 'node-transform',
      space: read(space)
    }),
    isEqual: (left, right) => (
      left.busy === right.busy
      && left.chrome === right.chrome
      && left.mode === right.mode
      && left.transforming === right.transforming
      && left.space === right.space
    )
  })
  let nextId = 1
  let current: RunningInteraction | null = null
  let currentControl: InteractionControl | null = null
  const autoPan = createAutoPan({
    getViewport
  })

  const matchesPointer = (
    pointerId: number | undefined,
    input: {
      pointerId: number
    }
  ) => pointerId === undefined || input.pointerId === pointerId

  const syncActive = (running: RunningInteraction | null) => {
    if (!running) {
      active.set(null)
      return
    }

    active.set({
      id: running.id,
      key: running.key,
      mode: running.active.mode,
      pointerId: running.pointerId,
      chrome: running.active.chrome
    })
  }

  const cleanup = (running: RunningInteraction) => {
    autoPan.stop()
    current = null
    currentControl = null
    syncActive(null)
    running.active.cleanup?.()
  }

  const start = (
    registration: InteractionRegistration,
    input: PointerDown
  ) => {
    if (active.get()) {
      return false
    }

    const id = nextId++
    let done = false
    let running: RunningInteraction | null = null
    let pendingResult: 'finish' | 'cancel' | null = null
    let pendingMode: ActiveInteractionMode | undefined
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

    const cancel = () => {
      if (!running) {
        pendingResult = 'cancel'
        return
      }

      if (done || active.get()?.id !== id || !running) {
        return
      }

      running.active.cancel?.()
      if (done || active.get()?.id !== id || !running) {
        return
      }

      done = true
      cleanup(running)
    }

    const control: InteractionControl = {
      finish,
      cancel,
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

        running.active = {
          ...running.active,
          mode: next.mode ?? running.active.mode,
          chrome:
            next.chrome === undefined
              ? running.active.chrome
              : next.chrome
        }
        syncActive(running)
      }
    }

    const nextActive = registration.start(input, control)
    if (!nextActive) {
      return false
    }

    const activeInteraction: any = nextActive
    const resolvedActive: RunningActiveInteraction = {
      ...activeInteraction,
      mode: pendingMode ?? activeInteraction.mode,
      chrome:
        pendingChrome === undefined
          ? activeInteraction.chrome
          : pendingChrome
    }

    running = {
      id,
      key: registration.key,
      pointerId: resolvedActive.pointerId ?? readDefaultPointerId(input),
      active: resolvedActive
    }

    if (pendingResult === 'cancel') {
      resolvedActive.cancel?.()
      resolvedActive.cleanup?.()
      return true
    }

    if (pendingResult === 'finish') {
      resolvedActive.cleanup?.()
      return true
    }

    current = running
    currentControl = control
    syncActive(running)

    if (resolvedActive.autoPan) {
      autoPan.start(resolvedActive.autoPan)
    }

    return true
  }

  const handleBlur = () => {
    if (space.get()) {
      space.set(false)
    }

    const running = current
    if (!running) {
      return
    }

    if (running.active.blur) {
      running.active.blur()
      return
    }

    currentControl?.cancel()
  }

  const handlePointerMove = (
    input: InteractionPointerInput
  ) => {
    const running = current
    if (!running || !matchesPointer(running.pointerId, input)) {
      return false
    }

    running.active.move?.(input)
    return true
  }

  const handlePointerUp = (
    input: InteractionPointerInput
  ) => {
    const running = current
    if (!running || !matchesPointer(running.pointerId, input)) {
      return false
    }

    running.active.up?.(input)
    return true
  }

  const handlePointerCancel = (
    input: {
      pointerId: number
    }
  ) => {
    if (!current || !matchesPointer(current.pointerId, input)) {
      return false
    }

    currentControl?.cancel()
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
    if (!running) {
      return handled
    }

    handled = true
    running.active.keydown?.(input)

    if (active.get() && input.key === 'Escape') {
      currentControl?.cancel()
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

    running.active.keyup?.(input)
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
      currentControl?.cancel()
    },
    handleKeyDown,
    handleKeyUp,
    handleBlur
  }
}
