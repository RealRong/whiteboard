import type { InteractionRegistration } from '../runtime/interaction'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import { createNodeDragInteraction } from './node/drag'
import {
  createSelectionPressRuntime,
  resolveSelectionPressState,
  type SelectionPressState
} from './selectionRuntime'
import type { MarqueeInteraction } from './marqueeRuntime'

type SelectionPressInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

export type SelectionPressInteraction = {
  interaction: InteractionRegistration<SelectionPressState>
  clear: () => void
}

export const createSelectionPressInteraction = (
  ctx: SelectionPressInteractionDeps,
  marquee: MarqueeInteraction
): SelectionPressInteraction => {
  const drag = createNodeDragInteraction(ctx)
  const runtime = createSelectionPressRuntime({
    ctx,
    marquee,
    drag
  })

  return {
    interaction: {
      key: 'selection.press',
      priority: 100,
      mode: 'press',
      chrome: (state) => Boolean(state.plan?.chrome),
      can: (input) => resolveSelectionPressState(ctx, input),
      start: ({ input, state, session }) => {
        runtime.startHold(input, state, session)
      },
      move: ({ input, state, session }, event) => {
        runtime.move(input, state, session, event)
      },
      up: ({ state, session }, event) => {
        runtime.up(state, session, event)
      },
      cancel: ({ state }) => {
        runtime.cancel(state)
      },
      cleanup: ({ state }) => {
        runtime.cleanup(state)
      }
    },
    clear: runtime.clear
  }
}
