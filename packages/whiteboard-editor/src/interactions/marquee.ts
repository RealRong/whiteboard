import type { InteractionRegistration } from '../runtime/interaction'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import {
  createMarqueeRuntime,
  createMarqueeState,
  type ActiveMarquee,
  type MarqueeInteraction,
  type MarqueeStartInput
} from './marqueeRuntime'

type MarqueeInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'viewport' | 'output'
>

export const createMarqueeInteraction = (
  ctx: MarqueeInteractionDeps
): MarqueeInteraction => {
  const runtime = createMarqueeRuntime(ctx)
  const createState = (
    input: MarqueeStartInput
  ) => createMarqueeState(input)

  const interaction: InteractionRegistration<ActiveMarquee, MarqueeStartInput> = {
    key: 'selection.marquee',
    mode: 'marquee',
    pan: (state) => ({
      frame: (pointer) => {
        runtime.pan(state, pointer)
      }
    }),
    start: ({ input }) => {
      runtime.start(input)
    },
    move: ({ state, session }, input) => {
      runtime.move(state, session, input)
    },
    up: ({ state, session }, input) => {
      runtime.up(state, session, input)
    },
    cleanup: () => {
      runtime.clear()
    }
  }

  return {
    interaction,
    createState,
    clear: runtime.clear
  }
}
