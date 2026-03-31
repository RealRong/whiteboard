import type { InteractionRegistration } from '../runtime/interaction'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import type { MindmapDragSession } from '@whiteboard/core/mindmap'
import {
  createMindmapDragRuntime,
  resolveMindmapDragState
} from './mindmapRuntime'

type MindmapDragInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

type ActiveMindmapDragSession = MindmapDragSession

export type MindmapDragInteraction = {
  interaction: InteractionRegistration<ActiveMindmapDragSession>
  clear: () => void
}

export const createMindmapDragInteraction = (
  ctx: MindmapDragInteractionDeps
): MindmapDragInteraction => {
  const runtime = createMindmapDragRuntime(ctx)

  return {
    interaction: {
      key: 'mindmap.drag',
      priority: 360,
      mode: 'mindmap-drag',
      can: (input) => resolveMindmapDragState(ctx, input),
      pan: (state) => ({
        frame: (pointer) => {
          runtime.projectInto(state, ctx.viewport.pointer(pointer).world)
        }
      }),
      start: ({ state }) => {
        runtime.start(state)
      },
      move: ({ state, setState, session }, input) => {
        runtime.move(state, input.world, setState)
        session.pan({
          clientX: input.client.x,
          clientY: input.client.y
        })
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
