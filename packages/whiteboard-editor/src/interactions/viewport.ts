import type {
  InteractionOwner,
  InteractionSession
} from '../runtime/interaction'
import type { InteractionCtx } from '../runtime/interaction/ctx'
import type {
  PointerMoveInput,
  PointerUpInput
} from '../types/input'

type PanState = {
  lastClient: {
    x: number
    y: number
  }
}

type ViewportInteractionDeps = Pick<
  InteractionCtx,
  'read' | 'interaction' | 'state'
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
  input: PointerMoveInput | PointerUpInput
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
  ctx.state.viewport.input.panScreenBy({
    x: -deltaX,
    y: -deltaY
  })
}

export const createViewportInteraction = (
  ctx: ViewportInteractionDeps
): InteractionOwner => ({
  key: 'viewport.pan',
  priority: 1000,
  start: (input, control): InteractionSession | null => {
    if (!ctx.state.inputPolicy.get().panEnabled) {
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
        x: input.client.x,
        y: input.client.y
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
