import type { InteractionFeature } from '../../../board'
import { createEdgeObserve } from './observe'
import { clearEdgeOverlay } from './overlay'
import { startEdgeInteraction } from './start'
import type { EdgeInteractionCtx } from './types'

export const createEdgeInteraction = (
  ctx: EdgeInteractionCtx
): InteractionFeature => {
  const observe = createEdgeObserve(ctx)

  return {
    owner: {
      key: 'edge',
      priority: 500,
      start: (input, control) => startEdgeInteraction(ctx, input, control),
      observe
    },
    clear: () => {
      observe.cancel?.()
      clearEdgeOverlay(ctx)
    }
  }
}
