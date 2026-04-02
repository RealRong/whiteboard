import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { Point } from '@whiteboard/core/types'
import type {
  MindmapDragFeedback,
  PointerDownInput
} from '../../../board'
import type {
  InteractionFeature,
  InteractionControl,
  InteractionSession
} from '../../../board'
import type { InteractionCtx } from '../../../board'

type MindmapInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'config' | 'commands' | 'overlay'
>

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

const resolveMindmapDragSession = (
  ctx: MindmapInteractionCtx,
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
  ctx: MindmapInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.mindmap.drag === undefined
      ? current
      : {
          ...current,
          mindmap: {
            drag: undefined
          }
        }
  ))
}

const writeMindmapDrag = (
  ctx: MindmapInteractionCtx,
  state: MindmapDragSession
) => {
  ctx.overlay.set((current) => ({
    ...current,
    mindmap: {
      drag: toMindmapDragFeedback(state)
    }
  }))
}

const projectMindmapSession = (
  ctx: MindmapInteractionCtx,
  state: MindmapDragSession,
  world: Point
): MindmapDragSession => projectMindmapDrag({
  active: state,
  world,
  treeView:
    state.kind === 'subtree'
      ? ctx.read.mindmap.item.get(state.treeId)
      : undefined
})

const commitMindmapDrag = (
  ctx: MindmapInteractionCtx,
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

const createMindmapSession = (
  ctx: MindmapInteractionCtx,
  initial: MindmapDragSession,
  control: InteractionControl
): InteractionSession => {
  let session = initial
  writeMindmapDrag(ctx, session)

  return {
    mode: 'mindmap-drag',
    pointerId: session.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        session = projectMindmapSession(
          ctx,
          session,
          ctx.read.viewport.pointer(pointer).world
        )
        writeMindmapDrag(ctx, session)
      }
    },
    move: (next) => {
      session = projectMindmapSession(ctx, session, next.world)
      writeMindmapDrag(ctx, session)
    },
    up: () => {
      commitMindmapDrag(ctx, session)
      control.finish()
    },
    cleanup: () => {
      clearMindmapDrag(ctx)
    }
  }
}

export const createMindmapInteraction = (
  ctx: MindmapInteractionCtx
): InteractionFeature => ({
  owner: {
    key: 'mindmap',
    priority: 110,
    start: (input, control) => {
      const state = resolveMindmapDragSession(ctx, input)
      return state
        ? {
            kind: 'session',
            session: createMindmapSession(ctx, state, control)
          }
        : null
    }
  },
  clear: () => {
    clearMindmapDrag(ctx)
  }
})
