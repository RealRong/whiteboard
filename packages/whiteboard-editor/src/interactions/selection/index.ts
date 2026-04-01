import type {
  InteractionCtx,
  InteractionOwner
} from '../../runtime/interaction'
import { createPressInteraction, resolveSelectionPressState } from './press'

type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'config' | 'commands' | 'overlay' | 'snap'
>

export type SelectionInteraction = {
  owner: InteractionOwner
  clear: () => void
}

const clearSelectionOverlay = (
  ctx: SelectionInteractionCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.selection.node.patches.length === 0
      && current.selection.node.hovered === undefined
      && current.selection.edge.length === 0
      && current.selection.marquee === undefined
      && current.selection.guides.length === 0
    )
      ? current
      : {
          ...current,
          selection: {
            node: {
              patches: [],
              hovered: undefined
            },
            edge: [],
            guides: []
          }
        }
  ))
}

export const createSelectionInteraction = (
  ctx: SelectionInteractionCtx
): SelectionInteraction => ({
  owner: {
    key: 'selection',
    priority: 100,
    start: (input, control) => {
      const state = resolveSelectionPressState(ctx, input)
      return state
        ? createPressInteraction(ctx, input, state, control)
        : null
    }
  },
  clear: () => {
    clearSelectionOverlay(ctx)
  }
})
