import type { MindmapDragSession } from '@whiteboard/core/mindmap'
import type { InteractionControl, InteractionSession } from '../../runtime/interaction'
import type { InteractionOwner } from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import { createMindmapInteraction, resolveMindmapDragSession } from './mindmap'
import type { SelectionInteractionCtx } from './context'
import { createPressInteraction, resolveSelectionPressState, type SelectionPressState } from './press'
import { createTransformInteraction, gatherTransformState, type TransformState } from './transform'

export type SelectionInteraction = {
  owner: InteractionOwner
  clear: () => void
}

type SelectionSession =
  | {
      kind: 'transform'
      state: TransformState
    }
  | {
      kind: 'mindmap'
      state: MindmapDragSession
    }
  | {
      kind: 'press'
      state: SelectionPressState
      start: PointerDownInput
    }

const clearSelectionFeedback = (
  ctx: SelectionInteractionCtx
) => {
  ctx.overlay.set((current) => (
    (
      current.node.selection.patches.length === 0
      && current.node.selection.hovered === undefined
      && current.edge.selection.length === 0
      && current.select.marquee === undefined
      && current.select.mindmapDrag === undefined
      && current.guides.snap.length === 0
    )
      ? current
      : {
          ...current,
          node: {
            ...current.node,
            selection: {
              patches: [],
              hovered: undefined
            }
          },
          edge: {
            ...current.edge,
            selection: []
          },
          select: {
            ...current.select,
            marquee: undefined,
            mindmapDrag: undefined
          },
          guides: {
            ...current.guides,
            snap: []
          }
        }
  ))
}

const startSelectionSession = (
  ctx: SelectionInteractionCtx,
  input: PointerDownInput
): SelectionSession | null => {
  const transformState = gatherTransformState(ctx, input)
  if (transformState) {
    return {
      kind: 'transform',
      state: transformState
    }
  }

  const mindmapState = resolveMindmapDragSession(ctx, input)
  if (mindmapState) {
    return {
      kind: 'mindmap',
      state: mindmapState
    }
  }

  const pressState = resolveSelectionPressState(ctx, input)
  if (!pressState) {
    return null
  }

  return {
    kind: 'press',
    state: pressState,
    start: input
  }
}

const createSelectionSession = (
  ctx: SelectionInteractionCtx,
  session: SelectionSession,
  control: InteractionControl
): InteractionSession => {
  if (session.kind === 'transform') {
    return createTransformInteraction(ctx, session.state, control)
  }

  if (session.kind === 'mindmap') {
    return createMindmapInteraction(ctx, session.state, control)
  }

  return createPressInteraction(ctx, session.start, session.state, control)
}

export const createSelectionInteraction = (
  ctx: SelectionInteractionCtx
): SelectionInteraction => ({
  owner: {
    key: 'selection',
    priority: 100,
    start: (input, control) => {
      const session = startSelectionSession(ctx, input)
      return session
        ? createSelectionSession(ctx, session, control)
        : null
    }
  },
  clear: () => {
    clearSelectionFeedback(ctx)
  }
})
