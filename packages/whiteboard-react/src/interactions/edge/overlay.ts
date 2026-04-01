import { resolveEdgeConnectPreview, type EdgeConnectState } from '@whiteboard/core/edge'
import type { EdgeId, EdgePatch } from '@whiteboard/core/types'
import type { EdgeGuide } from '../../runtime/overlay'
import type { EdgeInteractionCtx } from './types'

export const clearEdgePatches = (
  ctx: EdgeInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.edge.interaction.length === 0
      ? current
      : {
          ...current,
          edge: {
            ...current.edge,
            interaction: []
          }
        }
  ))
}

export const clearEdgeGuide = (
  ctx: EdgeInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.edge.guide === undefined
      ? current
      : {
          ...current,
          edge: {
            ...current.edge,
            guide: undefined
          }
        }
  ))
}

export const clearEdgeOverlay = (
  ctx: EdgeInteractionCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.edge.interaction.length === 0
      && current.edge.guide === undefined
    )
      ? current
      : {
          ...current,
          edge: {
            ...current.edge,
            interaction: [],
            guide: undefined
          }
        }
  ))
}

export const writeConnectPreview = (
  ctx: EdgeInteractionCtx,
  state: EdgeConnectState
) => {
  const preview = resolveEdgeConnectPreview(state)

  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      ...current.edge,
      interaction:
        state.kind === 'reconnect' && preview?.patch
          ? [{
              id: state.edgeId,
              patch: preview.patch
            }]
          : [],
      guide:
        preview
          ? {
              line: preview.line,
              snap: preview.snap
            } satisfies EdgeGuide
          : undefined
    }
  }))
}

export const writeEdgePatch = (
  ctx: EdgeInteractionCtx,
  input: {
    edgeId: EdgeId
    patch?: EdgePatch
    activeRouteIndex?: number
  }
) => {
  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      ...current.edge,
      interaction: [{
        id: input.edgeId,
        patch: input.patch,
        activeRouteIndex: input.activeRouteIndex
      }]
    }
  }))
}
