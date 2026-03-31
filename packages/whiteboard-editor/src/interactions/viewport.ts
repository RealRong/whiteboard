import type { ValueStore } from '@whiteboard/engine'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../runtime/interaction'
import type { FeatureRuntime } from '../../runtime/editor/featureRuntime'

type ViewportInputPolicy = {
  panEnabled: boolean
}

type ViewportPanState = {
  lastClient: {
    x: number
    y: number
  }
}

type ViewportPanInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'viewport'
>

const allowsLeftDrag = (
  ctx: ViewportPanInteractionDeps
) => (
  ctx.query.interaction.state.get().space
  || ctx.query.read.tool.is('hand')
)

const updatePan = (
  ctx: ViewportPanInteractionDeps,
  state: ViewportPanState,
  input: InteractionPointerInput
) => {
  const deltaX = input.client.x - state.lastClient.x
  const deltaY = input.client.y - state.lastClient.y
  if (deltaX === 0 && deltaY === 0) {
    return
  }

  state.lastClient = {
    x: input.client.x,
    y: input.client.y
  }
  ctx.viewport.input.panScreenBy({
    x: -deltaX,
    y: -deltaY
  })
}

export const createViewportPanInteraction = (
  ctx: ViewportPanInteractionDeps
): InteractionRegistration<ViewportPanState> => ({
  key: 'viewport.pan',
  priority: 1000,
  mode: 'viewport-pan',
  can: (input) => {
    if (!ctx.query.inputPolicy.get().panEnabled) {
      return null
    }

    if (input.ignoreInput) {
      return null
    }

    const middleDrag = input.button === 1 || (input.buttons & 4) === 4
    const leftDrag =
      (input.button === 0 || (input.buttons & 1) === 1)
      && allowsLeftDrag(ctx)

    if (!middleDrag && !leftDrag) {
      return null
    }

    return {
      lastClient: {
        x: input.point.client.x,
        y: input.point.client.y
      }
    }
  },
  start: ({ input }) => {
    void input
  },
  move: ({ state }, input) => {
    updatePan(ctx, state, input)
  },
  up: ({ session }) => {
    session.finish()
  }
})
