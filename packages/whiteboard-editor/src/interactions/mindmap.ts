import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { Point } from '@whiteboard/core/types'
import type { InteractionControl, InteractionSession } from '../../runtime/interaction'
import type { MindmapDragFeedback } from '../../runtime/overlay'
import type { PointerDownInput } from '../../types/input'
import type { SelectionInteractionCtx } from './context'
import { readViewport } from './context'

const toMindmapDragFeedback = (
  session: MindmapDragSession
): MindmapDragFeedback => {
  if (session.kind === 'root') {
    return {
      treeId: session.treeId,
      kind: 'root',
      baseOffset: session.position
    }
  }

  return {
    treeId: session.treeId,
    kind: 'subtree',
    baseOffset: session.baseOffset,
    preview: {
      nodeId: session.nodeId,
      ghost: session.ghost,
      drop: session.drop
    }
  }
}

export const resolveMindmapDragSession = (
  ctx: SelectionInteractionCtx,
  input: PointerDownInput
): MindmapDragSession | null => {
  const tool = ctx.read.tool.get()

  if (
    tool.type !== 'select'
    || input.pick.kind !== 'mindmap'
    || input.editable
    || input.ignoreInput
    || input.ignoreSelection
  ) {
    return null
  }

  const treeView = ctx.read.mindmap.item.get(input.pick.treeId)
  if (!treeView) {
    return null
  }

  const position = treeView.node.position
  if (!position) {
    return null
  }

  const baseOffset = {
    x: position.x,
    y: position.y
  }

  return input.pick.nodeId === treeView.tree.rootId
    ? createRootDrag({
        treeId: input.pick.treeId,
        pointerId: input.pointerId,
        start: input.world,
        origin: baseOffset
      })
    : createSubtreeDrag({
        treeId: input.pick.treeId,
        treeView,
        nodeId: input.pick.nodeId,
        pointerId: input.pointerId,
        world: input.world,
        baseOffset
      }) ?? null
}

const clearMindmapDrag = (
  ctx: SelectionInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.select.mindmapDrag === undefined
      ? current
      : {
          ...current,
          select: {
            ...current.select,
            mindmapDrag: undefined
          }
        }
  ))
}

const projectMindmapState = (
  ctx: SelectionInteractionCtx,
  state: MindmapDragSession,
  world: Point
): MindmapDragSession => {
  const next = projectMindmapDrag({
    active: state,
    world,
    treeView:
      state.kind === 'subtree'
        ? ctx.read.mindmap.item.get(state.treeId)
        : undefined
  })

  ctx.overlay.set((current) => ({
    ...current,
    select: {
      ...current.select,
      mindmapDrag: toMindmapDragFeedback(next)
    }
  }))

  return {
    ...next
  }
}

const projectMindmapInto = (
  ctx: SelectionInteractionCtx,
  state: MindmapDragSession,
  world: Point
) => {
  Object.assign(state, projectMindmapState(ctx, state, world))
}

const startMindmapDrag = (
  ctx: SelectionInteractionCtx,
  state: MindmapDragSession
) => {
  ctx.overlay.set((current) => ({
    ...current,
    select: {
      ...current.select,
      mindmapDrag: toMindmapDragFeedback(state)
    }
  }))
}

const commitMindmapDrag = (
  ctx: SelectionInteractionCtx,
  state: MindmapDragSession
) => {
  if (state.kind === 'root') {
    ctx.commands.mindmap.moveRoot({
      nodeId: state.treeId,
      position: state.position,
      origin: state.origin
    })
    return
  }

  if (!state.drop) {
    return
  }

  ctx.commands.mindmap.moveByDrop({
    id: state.treeId,
    nodeId: state.nodeId,
    drop: {
      parentId: state.drop.parentId,
      index: state.drop.index,
      side: state.drop.side
    },
    origin: {
      parentId: state.originParentId,
      index: state.originIndex
    },
    nodeSize: ctx.config.mindmapNodeSize,
    layout: state.layout
  })
}

export const createMindmapInteraction = (
  ctx: SelectionInteractionCtx,
  state: MindmapDragSession,
  control: InteractionControl
): InteractionSession => {
  startMindmapDrag(ctx, state)

  return {
    mode: 'mindmap-drag',
    pointerId: state.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        projectMindmapInto(
          ctx,
          state,
          readViewport(ctx).pointer(pointer).world
        )
      }
    },
    move: (next) => {
      projectMindmapInto(ctx, state, next.world)
    },
    up: () => {
      commitMindmapDrag(ctx, state)
      control.finish()
    },
    cleanup: () => {
      clearMindmapDrag(ctx)
    }
  }
}
