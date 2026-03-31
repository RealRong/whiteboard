import type { InteractionRegistration } from '../../runtime/interaction'
import type { FeatureRuntime } from '../../runtime/editor/createEditor'
import {
  createNodeTransformRuntime,
  resolveNodeTransformState,
  type ActiveTransform
} from './transformRuntime'

type NodeTransformInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

export type NodeTransformInteraction = {
  interaction: InteractionRegistration<ActiveTransform>
  clear: () => void
}

export const createNodeTransformInteraction = (
  ctx: NodeTransformInteractionDeps
): NodeTransformInteraction => {
  const runtime = createNodeTransformRuntime(ctx)

  return {
    interaction: {
      key: 'node.transform',
      priority: 400,
      mode: 'node-transform',
      can: (input) => resolveNodeTransformState(ctx, input),
      start: () => {
        runtime.clear()
      },
      move: ({ state }, input) => {
        runtime.updatePreview(state, input)
      },
      up: ({ state, session }) => {
        runtime.commit(state)
        session.finish()
      },
      cleanup: () => {
        runtime.clear()
      }
    },
    clear: runtime.clear
  }
}
