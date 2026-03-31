import type { InteractionRegistration } from '../runtime/interaction'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { readDrawStyle } from '../draw/model'
import {
  createDrawFeedback,
  type DrawFeedback
} from './drawFeedback'
import { createDrawStrokeInteraction } from './drawStroke'
import { createDrawEraseInteraction } from './drawErase'

type DrawInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
>

export type DrawInteraction = {
  preview: DrawFeedback['preview']
  interactions: readonly InteractionRegistration[]
  clear: () => void
}

const queryDrawNodeIdsInRect = (
  ctx: DrawInteractionDeps,
  rect: Rect
): readonly NodeId[] => ctx.query.read.node.idsInRect(rect, {
  match: 'touch'
}).filter((nodeId) => (
  ctx.query.read.node.item.get(nodeId)?.node.type === 'draw'
))

export const createDrawInteraction = (
  ctx: DrawInteractionDeps
): DrawInteraction => {
  const feedback = createDrawFeedback({
    output: ctx.output
  })

  const stroke = createDrawStrokeInteraction({
    readZoom: () => ctx.viewport.get().zoom,
    readStyle: (kind) => readDrawStyle(
      ctx.query.read.draw.preferences.get(),
      kind
    ),
    createNode: ctx.command.node.create,
    writePreview: feedback.writePreview,
    clearPreview: feedback.clearPreview
  })

  const erase = createDrawEraseInteraction({
    readZoom: () => ctx.viewport.get().zoom,
    queryDrawNodeIdsInRect: (rect) => queryDrawNodeIdsInRect(ctx, rect),
    deleteNodes: ctx.command.node.delete,
    writeHidden: feedback.writeHidden,
    clearHidden: feedback.clearHidden
  })

  return {
    preview: feedback.preview,
    interactions: [
      erase,
      stroke
    ],
    clear: feedback.clear
  }
}
