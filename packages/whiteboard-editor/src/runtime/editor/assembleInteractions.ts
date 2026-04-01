import type { Editor } from '../../types/editor'
import type { InteractionRegistration } from '../../types/runtime/interaction'
import { createDrawInteraction } from '../../interactions/draw'
import { createEdgeInteraction } from '../../interactions/edge'
import { createInsertInteraction } from '../../interactions/insert'
import { createSelectionInteraction } from '../../interactions/selection'
import { createViewportInteraction } from '../../interactions/viewport'
import type { PassiveInputProcessor } from '../input/passive'
import type { InteractionCtx } from '../interaction/ctx'

export type InteractionSet = {
  interactions: readonly InteractionRegistration[]
  passive: readonly PassiveInputProcessor[]
  feedback: Editor['feedback']
  lifecycle: {
    reset: () => void
    dispose: () => void
  }
}

export const assembleInteractions = (
  runtime: InteractionCtx
): InteractionSet => {
  const viewport = createViewportInteraction(runtime)
  const insert = createInsertInteraction(runtime)
  const draw = createDrawInteraction(runtime)
  const selection = createSelectionInteraction(runtime)
  const edge = createEdgeInteraction(runtime)

  const clear = () => {
    draw.clear()
    selection.clear()
    edge.clear()
  }

  return {
    interactions: [
      viewport,
      insert,
      draw.interaction,
      selection.interaction,
      edge.interaction
    ],
    passive: edge.passive,
    feedback: runtime.overlay.selectors.feedback,
    lifecycle: {
      reset: clear,
      dispose: clear
    }
  }
}
