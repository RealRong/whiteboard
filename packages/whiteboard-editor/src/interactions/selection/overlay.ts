import type {
  Guide,
  MoveStepResult
} from '@whiteboard/core/node'
import type { InteractionCtx } from '../../runtime/interaction'
import type {
  EdgeOverlayEntry,
  MarqueeOverlayState,
  NodePatchEntry
} from '../../runtime/overlay'
import type { TransformProjection } from '../transform/types'

type SelectionOverlayCtx = Pick<InteractionCtx, 'overlay'>

const EMPTY_NODE_PATCHES: readonly NodePatchEntry[] = []
const EMPTY_EDGE_PATCHES: readonly EdgeOverlayEntry[] = []
const EMPTY_GUIDES: readonly Guide[] = []

const toMoveNodePatches = (
  result: MoveStepResult
): readonly NodePatchEntry[] => result.preview.nodes.map(({ id, position }) => ({
  id,
  patch: {
    position
  }
}))

const toMoveEdgePatches = (
  result: MoveStepResult
): readonly EdgeOverlayEntry[] => result.preview.edges.map(({ id, patch }) => ({
  id,
  patch: {
    route: patch.route,
    source: patch.source,
    target: patch.target
  }
}))

const toTransformNodePatches = (
  projection: TransformProjection
): readonly NodePatchEntry[] => projection.patches.map(({
  id,
  position,
  size,
  rotation
}) => ({
  id,
  patch: {
    position,
    size,
    rotation
  }
}))

export const clearSelectionPreview = (
  ctx: SelectionOverlayCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.selection.node.patches.length === 0
      && current.selection.node.hovered === undefined
      && current.selection.edge.length === 0
      && current.selection.guides.length === 0
    )
      ? current
      : {
          ...current,
          selection: {
            ...current.selection,
            node: {
              patches: EMPTY_NODE_PATCHES,
              hovered: undefined
            },
            edge: EMPTY_EDGE_PATCHES,
            guides: EMPTY_GUIDES
          }
        }
  ))
}

export const clearSelectionTransient = (
  ctx: SelectionOverlayCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.selection.node.patches.length === 0
      && current.selection.node.hovered === undefined
      && current.selection.edge.length === 0
      && current.selection.marquee === undefined
      && current.selection.guides.length === 0
    )
      ? current
      : {
          ...current,
          selection: {
            node: {
              patches: EMPTY_NODE_PATCHES,
              hovered: undefined
            },
            edge: EMPTY_EDGE_PATCHES,
            guides: EMPTY_GUIDES
          }
        }
  ))
}

export const writeSelectionMovePreview = (
  ctx: SelectionOverlayCtx,
  result: MoveStepResult
) => {
  ctx.overlay.set((current) => ({
    ...current,
    selection: {
      ...current.selection,
      node: {
        patches: toMoveNodePatches(result),
        hovered: result.preview.hovered
      },
      edge: toMoveEdgePatches(result),
      guides: result.guides
    }
  }))
}

export const writeSelectionMarquee = (
  ctx: SelectionOverlayCtx,
  marquee: MarqueeOverlayState | undefined
) => {
  ctx.overlay.set((current) => (
    current.selection.marquee === marquee
      ? current
      : {
          ...current,
          selection: {
            ...current.selection,
            marquee
          }
        }
  ))
}

export const writeSelectionTransformPreview = (
  ctx: SelectionOverlayCtx,
  projection: TransformProjection
) => {
  ctx.overlay.set((current) => ({
    ...current,
    selection: {
      ...current.selection,
      node: {
        patches: toTransformNodePatches(projection),
        hovered: undefined
      },
      guides: projection.guides
    }
  }))
}
