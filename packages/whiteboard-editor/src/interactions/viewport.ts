import type {
  ActiveInteraction,
  InteractionPointerInput,
  InteractionRegistration
} from '../runtime/interaction'
import type { InteractionHost } from '../runtime/interaction/host'

type PanState = {
  lastClient: {
    x: number
    y: number
  }
}

type ViewportInteractionDeps = Pick<
  InteractionHost,
  'read' | 'interaction' | 'inputPolicy' | 'viewport'
>

const allowsLeftDrag = (
  ctx: ViewportInteractionDeps
) => (
  ctx.interaction.state.get().space
  || ctx.read.tool.is('hand')
)

const updatePan = (
  ctx: ViewportInteractionDeps,
  state: PanState,
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

export const createViewportInteraction = (
  ctx: ViewportInteractionDeps
): InteractionRegistration => ({
  key: 'viewport.pan',
  priority: 1000,
  start: (input, control): ActiveInteraction | null => {
    if (!ctx.inputPolicy.get().panEnabled) {
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

    const state: PanState = {
      lastClient: {
        x: input.point.client.x,
        y: input.point.client.y
      }
    }

    return {
      mode: 'viewport-pan',
      move: (event) => {
        updatePan(ctx, state, event)
      },
      up: () => {
        control.finish()
      }
    }
  }
})
