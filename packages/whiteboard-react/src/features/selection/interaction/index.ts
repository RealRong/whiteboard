import type {
  InteractionFeature,
  InteractionCtx
} from '../runtime'
import { clearSelectionTransient } from './overlay'
import { createPressInteraction, resolveSelectionPressState } from './press'

type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'config' | 'commands' | 'overlay' | 'snap'
>

export const createSelectionInteraction = (
  ctx: SelectionInteractionCtx
): InteractionFeature => ({
  owner: {
    key: 'selection',
    priority: 100,
    start: (input, control) => {
      const state = resolveSelectionPressState(ctx, input)
      return state
        ? {
            kind: 'session',
            session: createPressInteraction(ctx, input, state, control)
          }
        : null
    }
  },
  clear: () => {
    clearSelectionTransient(ctx)
  }
})
