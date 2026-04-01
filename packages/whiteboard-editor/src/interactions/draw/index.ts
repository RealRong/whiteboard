import type {
  InteractionFeature,
  InteractionControl,
  InteractionSession
} from '../../runtime/interaction'
import type { InteractionCtx } from '../../runtime/interaction/ctx'
import type { PointerDownInput, PointerSample } from '../../types/input'
import {
  clearStrokeOverlay,
  commitStrokeSession,
  startStrokeSession,
  stepStrokeSession,
  type StrokeSession,
  writeStrokeSession
} from './draw'
import {
  clearEraseOverlay,
  commitEraseSession,
  startEraseSession,
  stepEraseSession,
  type EraseSession,
  writeEraseOverlay,
  writeEraseSession
} from './erase'

type DrawInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'commands' | 'overlay'
>

type DrawPointer = {
  samples: readonly PointerSample[]
}

type DrawSession = StrokeSession | EraseSession

const clearDrawOverlay = (
  ctx: DrawInteractionCtx
) => {
  clearStrokeOverlay(ctx)
  clearEraseOverlay(ctx)
}

const resolveDrawSession = (
  ctx: DrawInteractionCtx,
  input: PointerDownInput
): DrawSession | null => (
  startEraseSession(ctx, input)
  ?? startStrokeSession(ctx, input)
)

const stepDrawSession = (
  ctx: DrawInteractionCtx,
  session: DrawSession,
  input: DrawPointer,
  force = false
) => (
  session.kind === 'stroke'
    ? stepStrokeSession(session, input, force)
    : stepEraseSession(ctx, session, input)
)

const writeDrawSession = (
  ctx: DrawInteractionCtx,
  previous: DrawSession,
  next: DrawSession
) => {
  if (next.kind === 'stroke') {
    writeStrokeSession(
      ctx,
      previous.kind === 'stroke' ? previous : next,
      next
    )
    return
  }

  writeEraseSession(
    ctx,
    previous.kind === 'erase' ? previous : next,
    next
  )
}

const commitDrawSession = (
  ctx: DrawInteractionCtx,
  session: DrawSession
) => {
  if (session.kind === 'stroke') {
    commitStrokeSession(ctx, session)
    return
  }

  commitEraseSession(ctx, session)
}

const createDrawSession = (
  ctx: DrawInteractionCtx,
  initial: DrawSession,
  control: InteractionControl
): InteractionSession => {
  let session = initial

  if (session.kind === 'erase' && session.ids.length > 0) {
    writeEraseOverlay(ctx, session)
  }

  const step = (
    input: DrawPointer,
    force = false
  ) => {
    const nextSession = stepDrawSession(ctx, session, input, force)
    writeDrawSession(ctx, session, nextSession)
    session = nextSession
  }

  return {
    mode: 'draw',
    move: (input) => {
      step(input)
    },
    up: (input) => {
      step(input, true)
      commitDrawSession(ctx, session)
      control.finish()
    },
    cleanup: () => {
      if (session.kind === 'stroke') {
        clearStrokeOverlay(ctx)
        return
      }

      clearEraseOverlay(ctx)
    }
  }
}

export const createDrawInteraction = (
  ctx: DrawInteractionCtx
): InteractionFeature => ({
  owner: {
    key: 'draw',
    priority: 600,
    start: (input, control) => {
      const session = resolveDrawSession(ctx, input)

      return session
        ? {
            kind: 'session',
            session: createDrawSession(ctx, session, control)
          }
        : null
    }
  },
  clear: () => {
    clearDrawOverlay(ctx)
  }
})
