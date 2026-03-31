import type { Editor } from '../../types/editor'
import type { InteractionRegistration } from '../../types/runtime/interaction'
import { createDrawInteraction } from '../../interactions/draw'
import { createEdgeConnectInteraction } from '../../interactions/edge/connect'
import { createEdgeEditInteraction } from '../../interactions/edge/edit'
import { createEdgeHoverProcessor } from '../../interactions/edge/hover'
import { createInsertPresetInteraction } from '../../interactions/insert'
import { createMindmapDragInteraction } from '../../interactions/mindmap'
import { createNodeTransformInteraction } from '../../interactions/node/transform'
import { createMarqueeInteraction } from '../../interactions/marquee'
import { createSelectionPressInteraction } from '../../interactions/selection'
import { createViewportPanInteraction } from '../../interactions/viewport'
import type { PassiveInputProcessor } from '../input/passive'
import type { FeatureRuntime } from './createEditor'

export type InteractionSet = {
  interactions: readonly InteractionRegistration[]
  passive: readonly PassiveInputProcessor[]
  feedback: Editor['feedback']
  lifecycle: {
    reset: () => void
    dispose: () => void
  }
}

const toPublicEdgeGuide = (
  edgeGuide: FeatureRuntime['output']['edgeGuide']
): Editor['feedback']['edgeGuide'] => ({
  get: edgeGuide.get,
  subscribe: edgeGuide.subscribe
})

export const assembleInteractions = (
  runtime: FeatureRuntime
): InteractionSet => {
  const viewport = createViewportPanInteraction(runtime)
  const insert = createInsertPresetInteraction(runtime)
  const draw = createDrawInteraction(runtime)
  const marquee = createMarqueeInteraction(runtime)
  const selection = createSelectionPressInteraction(runtime, marquee)
  const node = createNodeTransformInteraction(runtime)
  const edgeConnect = createEdgeConnectInteraction(runtime)
  const edgeEdit = createEdgeEditInteraction(runtime)
  const edgeHover = createEdgeHoverProcessor(runtime)
  const mindmap = createMindmapDragInteraction(runtime)

  const clear = () => {
    draw.clear()
    selection.clear()
    node.clear()
    edgeEdit.clear()
    mindmap.clear()
    runtime.output.snap.node.clear()
  }

  return {
    interactions: [
      viewport,
      insert,
      ...draw.interactions,
      selection.interaction,
      node.interaction,
      edgeConnect.create,
      edgeConnect.reconnect,
      edgeEdit.route,
      edgeEdit.body,
      mindmap.interaction
    ],
    passive: [edgeHover],
    feedback: {
      draw: draw.preview,
      edgeGuide: toPublicEdgeGuide(runtime.output.edgeGuide),
      marquee: runtime.output.marquee,
      mindmapDrag: runtime.output.mindmapDrag,
      snap: runtime.output.snap.node.guides
    },
    lifecycle: {
      reset: clear,
      dispose: clear
    }
  }
}
