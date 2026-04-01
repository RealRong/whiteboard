import type { InteractionRegistration } from '../../runtime/interaction'
import type { InteractionHost } from '../../runtime/interaction/host'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { readDrawStyle } from '../../draw/model'
import type { DrawBrushKind } from '../../types/tool'
import type { DrawPreview } from '../../types/draw'
import { startStrokePhase } from './stroke'
import { startErasePhase } from './erase'

type DrawInteractionDeps = Pick<
  InteractionHost,
  'read' | 'commands' | 'viewport' | 'overlay'
>

export type DrawInteraction = {
  interaction: InteractionRegistration
  clear: () => void
}

const queryDrawNodeIdsInRect = (
  ctx: DrawInteractionDeps,
  rect: Rect
): readonly NodeId[] => ctx.read.node.idsInRect(rect, {
  match: 'touch'
}).filter((nodeId) => (
  ctx.read.node.item.get(nodeId)?.node.type === 'draw'
))

export const createDrawInteraction = (
  ctx: DrawInteractionDeps
): DrawInteraction => {
  const strokeDeps = {
    readZoom: () => ctx.viewport.get().zoom,
    readStyle: (kind: DrawBrushKind) => readDrawStyle(
      ctx.read.draw.preferences.get(),
      kind
    ),
    createNode: ctx.commands.node.create,
    writePreview: (preview: DrawPreview | null) => {
      ctx.overlay.set((current) => ({
        ...current,
        draw: {
          preview
        }
      }))
    },
    clearPreview: () => {
      ctx.overlay.set((current) => (
        current.draw.preview === null
          ? current
          : {
              ...current,
              draw: {
                preview: null
              }
            }
      ))
    }
  }

  const eraseDeps = {
    readZoom: () => ctx.viewport.get().zoom,
    queryDrawNodeIdsInRect: (rect: Rect) => queryDrawNodeIdsInRect(ctx, rect),
    deleteNodes: ctx.commands.node.delete,
    writeHidden: (nodeIds: readonly NodeId[]) => {
      ctx.overlay.set((current) => ({
        ...current,
        node: {
          ...current.node,
          hidden: nodeIds
        }
      }))
    },
    clearHidden: () => {
      ctx.overlay.set((current) => (
        current.node.hidden.length === 0
          ? current
          : {
              ...current,
              node: {
                ...current.node,
                hidden: []
              }
            }
      ))
    }
  }

  return {
    interaction: {
      key: 'draw',
      priority: 600,
      start: (input, control) => (
        startErasePhase(eraseDeps, input, control)
        ?? startStrokePhase(strokeDeps, input, control)
      )
    },
    clear: () => {
      strokeDeps.clearPreview()
      eraseDeps.clearHidden()
    }
  }
}
