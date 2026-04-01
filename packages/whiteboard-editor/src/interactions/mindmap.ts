import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { Point } from '@whiteboard/core/types'
import type { PointerDown } from '../runtime/input/pointer'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import type { MindmapDragFeedback } from '../runtime/feedback/mindmapDrag'
import {
  moveMindmapByDrop,
  moveMindmapRoot
} from '../runtime/commands/mindmap'

type MindmapDragInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'command' | 'viewport' | 'output'
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

export const resolveMindmapDragState = (
  ctx: MindmapDragInteractionDeps,
  input: PointerDown
): MindmapDragSession | null => {
  if (
    input.tool.type !== 'select'
    || input.pick.kind !== 'mindmap'
    || input.editable
    || input.ignoreInput
    || input.ignoreSelection
  ) {
    return null
  }

  const treeView = ctx.query.read.mindmap.item.get(input.pick.treeId)
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
        start: input.point.world,
        origin: baseOffset
      })
    : createSubtreeDrag({
        treeId: input.pick.treeId,
        treeView,
        nodeId: input.pick.nodeId,
        pointerId: input.pointerId,
        world: input.point.world,
        baseOffset
      }) ?? null
}

export const createMindmapDragRuntime = (
  ctx: MindmapDragInteractionDeps
) => {
  const clear = () => {
    ctx.output.mindmapDrag.clear()
  }

  const project = (
    state: MindmapDragSession,
    world: Point
  ): MindmapDragSession => {
    const next = projectMindmapDrag({
      active: state,
      world,
      treeView:
        state.kind === 'subtree'
          ? ctx.query.read.mindmap.item.get(state.treeId)
          : undefined
    })

    ctx.output.mindmapDrag.set(
      toMindmapDragFeedback(next)
    )

    return {
      ...next
    }
  }

  const projectInto = (
    state: MindmapDragSession,
    world: Point
  ) => {
    Object.assign(state, project(state, world))
  }

  const start = (
    state: MindmapDragSession
  ) => {
    ctx.output.mindmapDrag.set(
      toMindmapDragFeedback(state)
    )
  }

  const move = (
    state: MindmapDragSession,
    world: Point,
    setState: (next: MindmapDragSession) => void
  ) => {
    projectInto(state, world)
    setState(state)
  }

  const commit = (
    state: MindmapDragSession
  ) => {
    if (state.kind === 'root') {
      moveMindmapRoot({
        editor: {
          commands: ctx.command,
          read: ctx.query.read
        },
        nodeId: state.treeId,
        position: state.position,
        origin: state.origin
      })
      return
    }

    if (!state.drop) {
      return
    }

    moveMindmapByDrop({
      editor: {
        commands: ctx.command,
        read: ctx.query.read
      },
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
      nodeSize: ctx.query.config.mindmapNodeSize,
      layout: state.layout
    })
  }

  return {
    clear,
    start,
    move,
    commit,
    projectInto
  }
}
