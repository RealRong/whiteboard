import type {
  InteractionFeature,
  InteractionSession,
  InteractionControl
} from '../../runtime/interaction'
import { commitTransform } from './commit'
import { clearTransformOverlay, writeTransformProjection } from './overlay'
import { projectTransform } from './project'
import { startTransformSession } from './start'
import type {
  TransformInteractionCtx,
  TransformPointerInput
} from './types'

const createTransformSession = (
  ctx: TransformInteractionCtx,
  initial: NonNullable<ReturnType<typeof startTransformSession>>,
  control: InteractionControl
): InteractionSession => {
  let latest = null as ReturnType<typeof projectTransform> | null

  clearTransformOverlay(ctx)
  const project = (
    input: TransformPointerInput
  ) => {
    const projection = projectTransform(ctx, initial, input)
    latest = projection
    writeTransformProjection(ctx, projection)
  }

  return {
    mode: 'node-transform',
    pointerId: initial.drag.pointerId,
    chrome: false,
    move: (input) => {
      project(input)
    },
    up: (input) => {
      project(input)
      commitTransform(ctx, initial, latest)
      control.finish()
    },
    cleanup: () => {
      clearTransformOverlay(ctx)
    }
  }
}

export const createTransformInteraction = (
  ctx: TransformInteractionCtx
): InteractionFeature => ({
  owner: {
    key: 'transform',
    priority: 120,
    start: (input, control) => {
      const session = startTransformSession(ctx, input)
      return session
        ? {
            kind: 'session',
            session: createTransformSession(ctx, session, control)
          }
        : null
    }
  },
  clear: () => {
    clearTransformOverlay(ctx)
  }
})
