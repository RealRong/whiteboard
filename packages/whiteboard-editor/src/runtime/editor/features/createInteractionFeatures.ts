import type { Editor } from '../../../types/editor'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'
import type { InteractionRegistration } from '../../../types/runtime/interaction'
import type { PassiveInputProcessor } from '../../input/passive'
import { createDrawFeature } from './draw'
import { createEdgeFeature } from './edge'
import { createInsertFeature } from './insert'
import { createMindmapFeature } from './mindmap'
import { createNodeFeature } from './node'
import { createSelectionFeature } from './selection'
import { createViewportFeature } from './viewport'

export type InteractionFeatures = {
  interactions: readonly InteractionRegistration[]
  passive: readonly PassiveInputProcessor[]
  projection: Editor['projection']
  lifecycle: {
    reset: () => void
    dispose: () => void
  }
}

const toPublicEdgeProjection = (
  edge: EditorFeatureContext['projection']['edge']
): Editor['projection']['edge'] => ({
  patch: {
    get: edge.patch.get,
    subscribe: edge.patch.subscribe
  },
  hint: {
    get: edge.hint.get,
    subscribe: edge.hint.subscribe
  },
  emptyPatch: edge.emptyPatch
})

export const createInteractionFeatures = (
  ctx: EditorFeatureContext
): InteractionFeatures => {
  const viewport = createViewportFeature(ctx)
  const insert = createInsertFeature(ctx)
  const draw = createDrawFeature(ctx)
  const selection = createSelectionFeature(ctx)
  const node = createNodeFeature(ctx)
  const edge = createEdgeFeature(ctx)
  const mindmap = createMindmapFeature(ctx)

  const clear = () => {
    draw.clear()
    selection.clear()
    node.clear()
    edge.clear()
    mindmap.clear()
    ctx.spatial.snap.node.clear()
  }

  return {
    interactions: [
      viewport.interaction,
      insert.interaction,
      ...draw.interactions,
      selection.interaction,
      node.interaction,
      ...edge.interactions,
      mindmap.interaction
    ],
    passive: edge.passive,
    projection: {
      marquee: selection.marquee,
      draw: draw.preview,
      edge: toPublicEdgeProjection(ctx.projection.edge),
      mindmapDrag: ctx.projection.mindmapDrag,
      snap: ctx.spatial.snap.node.guides
    },
    lifecycle: {
      reset: clear,
      dispose: clear
    }
  }
}
