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
    current.guides.edge === undefined
      ? current
      : {
          ...current,
          guides: {
            ...current.guides,
            edge: undefined
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
      && current.guides.edge === undefined
    )
      ? current
      : {
          ...current,
          edge: {
            ...current.edge,
            interaction: []
          },
          guides: {
            ...current.guides,
            edge: undefined
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
          : []
    },
    guides: {
      ...current.guides,
      edge:
        preview
          ? {
              line: preview.line,
              snap: preview.snap
            } satisfies EdgeGuide
          : undefined
    }
  }))
}

export const writeRoutePreview = (
  ctx: EdgeInteractionCtx,
  edgeId: EdgeId,
  patch?: EdgePatch,
  activeRouteIndex?: number
) => {
  ctx.overlay.set((current) => ({
    ...current,
    edge: {
      ...current.edge,
      interaction: [{
        id: edgeId,
        patch,
        activeRouteIndex
      }]
    }
  }))
}
