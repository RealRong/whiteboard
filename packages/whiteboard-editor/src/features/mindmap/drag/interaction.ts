import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { EditorRuntime } from '../../../types/internal/editor'
import type {
  InteractionPointerInput,
  InteractionRegistration
} from '../../../runtime/interaction'
import type { MindmapDragProjection } from './projection'
import {
  moveMindmapByDrop,
  moveMindmapRoot
} from '../commands'

type ActiveMindmapDragSession = MindmapDragSession

export type MindmapDragInteraction = {
  interaction: InteractionRegistration<ActiveMindmapDragSession>
  clear: () => void
}

type MindmapDragInteractionDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      overlay: {
        mindmapDrag: Pick<
          EditorRuntime['internals']['projections']['overlay']['mindmapDrag'],
          'set' | 'clear'
        >
      }
    }
  }
}

const toMindmapDragProjection = (
  session: MindmapDragSession
): MindmapDragProjection => {
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

export const createMindmapDragInteraction = (
  editor: MindmapDragInteractionDeps
): MindmapDragInteraction => {
  const clear = () => {
    editor.internals.projections.overlay.mindmapDrag.clear()
  }

  const projectState = (
    state: ActiveMindmapDragSession,
    world: {
      x: number
      y: number
    }
  ): ActiveMindmapDragSession => {
    const next = projectMindmapDrag({
      active: state,
      world,
      treeView:
        state.kind === 'subtree'
          ? editor.read.mindmap.item.get(state.treeId)
          : undefined
    })

    editor.internals.projections.overlay.mindmapDrag.set(
      toMindmapDragProjection(next)
    )
    return {
      ...next
    }
  }

  const interaction: InteractionRegistration<ActiveMindmapDragSession> = {
    key: 'mindmap.drag',
    priority: 360,
    mode: 'mindmap-drag',
    can: (input) => {
      if (
        input.tool.type !== 'select'
        || input.pick.kind !== 'mindmap'
        || input.editable
        || input.ignoreInput
        || input.ignoreSelection
      ) {
        return null
      }

      const treeView = editor.read.mindmap.item.get(input.pick.treeId)
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
            pointerId: input.event.pointerId,
            start: input.point.world,
            origin: baseOffset
          })
        : createSubtreeDrag({
            treeId: input.pick.treeId,
            treeView,
            nodeId: input.pick.nodeId,
            pointerId: input.event.pointerId,
            world: input.point.world,
            baseOffset
          }) ?? null
    },
    pan: (state) => ({
      frame: (pointer) => {
        const next = projectState(
          state,
          editor.viewport.pointer(pointer).world
        )
        Object.assign(state, next)
      }
    }),
    start: ({ input, state }) => {
      editor.internals.projections.overlay.mindmapDrag.set(
        toMindmapDragProjection(state)
      )
      input.event.preventDefault()
      input.event.stopPropagation()
    },
    move: ({ state, setState, session }, input) => {
      const next = projectState(state, input.world)
      Object.assign(state, next)
      setState(state)
      session.pan(input.raw)
    },
    up: ({ state, session }) => {
      if (state.kind === 'root') {
        moveMindmapRoot({
          editor,
          nodeId: state.treeId,
          position: state.position,
          origin: state.origin
        })
        session.finish()
        return
      }

      if (state.drop) {
        moveMindmapByDrop({
          editor,
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
          nodeSize: editor.config.mindmapNodeSize,
          layout: state.layout
        })
      }

      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  return {
    interaction,
    clear
  }
}
