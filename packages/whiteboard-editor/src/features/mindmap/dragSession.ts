import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { InternalEditor } from '../../runtime/instance/types'
import type { MindmapDown } from '../../runtime/input/pointer'
import type { MindmapDragState } from './session/drag'
import {
  moveMindmapByDrop,
  moveMindmapRoot
} from './commands'

type ActiveMindmapDragSession = MindmapDragSession

export type MindmapDragController = {
  down: (input: MindmapDown) => boolean
  cancel: () => void
}

type MindmapDragSessionDeps = Pick<
  InternalEditor,
  'commands' | 'config' | 'interaction' | 'read' | 'viewport'
> & {
  internals: Pick<InternalEditor['internals'], 'mindmapDrag'>
}

const toMindmapDragState = (session: MindmapDragSession): MindmapDragState => {
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

export const createMindmapDragSession = (
  instance: MindmapDragSessionDeps
): MindmapDragController => {
  let active: ActiveMindmapDragSession | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const clear = () => {
    active = null
    session = null
    instance.internals.mindmapDrag.clear()
  }

  const updatePreview = (
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    if (!active) {
      return
    }

    const { world } = instance.viewport.pointer(input)
    const next = projectMindmapDrag({
      active,
      world,
      treeView:
        active.kind === 'subtree'
          ? instance.read.mindmap.item.get(active.treeId)
          : undefined
    })
    active = {
      ...next
    }
    instance.internals.mindmapDrag.write(toMindmapDragState(next))
  }

  const start = (
    capture: Element,
    event: PointerEvent,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => {
    const treeView = instance.read.mindmap.item.get(treeId)
    if (!treeView) {
      return false
    }

    const nextSession = instance.interaction.start({
      mode: 'mindmap-drag',
      pointerId: event.pointerId,
      capture,
      pan: {
        frame: (pointer) => {
          updatePreview(pointer)
        }
      },
      cleanup: clear,
      move: (moveEvent, interactionSession) => {
        if (!active) {
          return
        }

        interactionSession.pan(moveEvent)
        updatePreview(moveEvent)
      },
      up: (_event, interactionSession) => {
        if (!active) {
          return
        }

        if (active.kind === 'root') {
          moveMindmapRoot({
            instance,
            nodeId: active.treeId,
            position: active.position,
            origin: active.origin
          })
          interactionSession.finish()
          return
        }

        if (active.drop) {
          moveMindmapByDrop({
            instance,
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
            nodeSize: instance.config.mindmapNodeSize,
            layout: active.layout
          })
        }

        interactionSession.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    const { world } = instance.viewport.pointer(event)
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

    active = {
      ...next
    }
    session = nextSession
    instance.internals.mindmapDrag.write(toMindmapDragState(next))
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    down: (input) => {
      if (active) {
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
      if (session) {
        session.cancel()
        return
      }

      clear()
    }
  }
}
