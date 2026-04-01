import type { InteractionRegistration } from '../../runtime/interaction'
import type { InteractionHost } from '../../runtime/interaction/host'
import type { PassiveInputProcessor } from '../../runtime/input/passive'
import {
  startEdgeCreatePhase,
  startEdgeReconnectPhase
} from './connect'
import {
  startEdgeBodyPhase,
  startEdgeRoutePhase
} from './edit'
import { createEdgeHoverProcessor } from './hover'

type EdgeInteractionDeps = Pick<
  InteractionHost,
  'read' | 'config' | 'commands' | 'viewport' | 'overlay' | 'snap' | 'interaction'
>

export type EdgeInteraction = {
  interaction: InteractionRegistration
  passive: readonly PassiveInputProcessor[]
  clear: () => void
}

export const createEdgeInteraction = (
  ctx: EdgeInteractionDeps
): EdgeInteraction => {
  const hover = createEdgeHoverProcessor(ctx)

  const interaction: InteractionRegistration = {
    key: 'edge',
    priority: 500,
    start: (input, control) => (
      startEdgeCreatePhase(ctx, input, control)
      ?? startEdgeReconnectPhase(ctx, input, control)
      ?? startEdgeRoutePhase(ctx, input, control)
      ?? startEdgeBodyPhase(ctx, input, control)
    )
  }

  return {
    interaction,
    passive: [hover],
    clear: () => {
      hover.cancel?.()
      ctx.overlay.set((current) => (
        (
          current.edge.patches.length === 0
          && current.guides.edge === undefined
        )
          ? current
          : {
              ...current,
              edge: {
                patches: []
              },
              guides: {
                ...current.guides,
                edge: undefined
              }
            }
      ))
    }
  }
}
