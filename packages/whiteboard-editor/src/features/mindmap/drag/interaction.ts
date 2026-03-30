import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { EditorRuntime } from '../../../types/internal/editor'
import { createInteractionSessionSlot } from '../../../runtime/interaction'
import type { PointerDown } from '../../../runtime/input/pointer'
import type { MindmapDragProjection } from './projection'
import {
  moveMindmapByDrop,
  moveMindmapRoot
} from '../commands'

type ActiveMindmapDragSession = MindmapDragSession

export type MindmapDragInteraction = {
  start: (input: PointerDown) => boolean
  cancel: () => void
}

type MindmapDragInteractionDeps = Pick<
  EditorRuntime,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      overlay: Pick<EditorRuntime['internals']['projections']['overlay'], 'mindmapDrag'>
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
  const interaction = createInteractionSessionSlot<ActiveMindmapDragSession>({
    interaction: editor.interaction,
    cleanup: () => {
      editor.internals.projections.overlay.mindmapDrag.clear()
    }
  })

  const readActive = () => interaction.getActive()

  const writeActive = (
    next: ActiveMindmapDragSession | null
  ) => {
    interaction.setActive(next)
  }

  const updateProjection = (
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = readActive()
    if (!active) {
      return
    }

    const { world } = editor.viewport.pointer(input)
    const next = projectMindmapDrag({
      active,
      world,
      treeView:
        active.kind === 'subtree'
          ? editor.read.mindmap.item.get(active.treeId)
          : undefined
    })
    writeActive({
      ...next
    })
    editor.internals.projections.overlay.mindmapDrag.write(
      toMindmapDragProjection(next)
    )
  }

  const start = (
    capture: Element,
    event: PointerEvent,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => {
    const treeView = editor.read.mindmap.item.get(treeId)
    if (!treeView) {
      return false
    }

    const nextSession = interaction.start({
      mode: 'mindmap-drag',
      pointerId: event.pointerId,
      capture,
      pan: {
        frame: (pointer) => {
          updateProjection(pointer)
        }
      },
      move: (moveEvent, interactionSession) => {
        const active = readActive()
        if (!active) {
          return
        }

        interactionSession.pan(moveEvent)
        updateProjection(moveEvent)
      },
      up: (_event, interactionSession) => {
        const active = readActive()
        if (!active) {
          return
        }

        if (active.kind === 'root') {
          moveMindmapRoot({
            editor,
            nodeId: active.treeId,
            position: active.position,
            origin: active.origin
          })
          interactionSession.finish()
          return
        }

        if (active.drop) {
          moveMindmapByDrop({
            editor,
            id: active.treeId,
            nodeId: active.nodeId,
            drop: {
              parentId: active.drop.parentId,
              index: active.drop.index,
              side: active.drop.side
            },
            origin: {
              parentId: active.originParentId,
              index: active.originIndex
            },
            nodeSize: editor.config.mindmapNodeSize,
            layout: active.layout
          })
        }

        interactionSession.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    const { world } = editor.viewport.pointer(event)
    const position = treeView.node.position
    if (!position) {
      nextSession.cancel()
      return false
    }
    const baseOffset = {
      x: position.x,
      y: position.y
    }

    const next =
      nodeId === treeView.tree.rootId
        ? createRootDrag({
            treeId,
            pointerId: event.pointerId,
            start: world,
            origin: baseOffset
          })
        : createSubtreeDrag({
            treeId,
            treeView,
            nodeId,
            pointerId: event.pointerId,
            world,
            baseOffset
          })

    if (!next) {
      nextSession.cancel()
      return false
    }

    writeActive({
      ...next
    })
    editor.internals.projections.overlay.mindmapDrag.write(
      toMindmapDragProjection(next)
    )
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    start: (input) => {
      if (interaction.hasActive()) {
        return false
      }

      if (input.pick.kind !== 'mindmap') {
        return false
      }

      return start(
        input.capture,
        input.event,
        input.pick.treeId,
        input.pick.nodeId
      )
    },
    cancel: () => {
      interaction.cancel()
    }
  }
}
