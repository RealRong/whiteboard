import type { MindmapNodeId, NodeId, Point } from '@whiteboard/core/types'
import { interactionLock, type InteractionLockToken } from './interactionLock'
import type { InternalWhiteboardInstance } from '../instance/types'
import {
  resolveNextMindmapDragSession,
  resolveRootDragSession,
  resolveSubtreeDragSession,
  toDragView,
  type MindmapDragSession
} from '../../features/mindmap/hooks/drag/math'
import { createSignal } from './signal'
import type { MindmapDragInteractionRuntime } from './types'

type ActiveMindmapDragSession = MindmapDragSession & {
  lockToken: InteractionLockToken
}

const readPointerWorld = (
  instance: InternalWhiteboardInstance,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

export const createMindmapDragInteractionRuntime = (
  getInstance: () => InternalWhiteboardInstance
): MindmapDragInteractionRuntime => {
  let active: ActiveMindmapDragSession | null = null
  const pointer = createSignal<number | null>(null)

  const cancel = (pointerId?: number) => {
    const instance = getInstance()
    if (!active) return
    if (pointerId !== undefined && active.pointerId !== pointerId) return

    const previous = active
    active = null
    pointer.set(null)
    instance.draft.mindmap.clear()
    interactionLock.release(instance, previous.lockToken)
  }

  return {
    pointer,
    cancel,
    handleMindmapNodePointerDown: (event, treeId, nodeId) => {
      const instance = getInstance()
      if (event.button !== 0) return
      if (active) return
      if (
        event.target instanceof Element
        && event.target.closest('[data-selection-ignore]')
      ) {
        return
      }

      const treeView = instance.read.mindmap.get(treeId)
      if (!treeView) return

      const lockToken = interactionLock.tryAcquire(instance, 'mindmapDrag', event.pointerId)
      if (!lockToken) return

      const world = readPointerWorld(instance, event)
      const baseOffset = {
        x: treeView.node.position.x,
        y: treeView.node.position.y
      }

      const next =
        nodeId === treeView.tree.rootId
          ? resolveRootDragSession({
            treeId,
            pointerId: event.pointerId,
            start: world,
            origin: baseOffset
          })
          : resolveSubtreeDragSession({
            treeId,
            treeView,
            nodeId,
            pointerId: event.pointerId,
            world,
            baseOffset
          })

      if (!next) {
        interactionLock.release(instance, lockToken)
        return
      }

      active = {
        ...next,
        lockToken
      }
      pointer.set(event.pointerId)
      instance.draft.mindmap.write(toDragView(next))
      event.preventDefault()
      event.stopPropagation()
    },
    onWindowPointerMove: (event) => {
      const instance = getInstance()
      if (!active || event.pointerId !== active.pointerId) return

      const world = readPointerWorld(instance, event)
      const next = resolveNextMindmapDragSession({
        active,
        world,
        treeView:
          active.kind === 'subtree'
            ? instance.read.mindmap.get(active.treeId)
            : undefined
      })
      active = {
        ...next,
        lockToken: active.lockToken
      }
      instance.draft.mindmap.write(toDragView(next))
    },
    onWindowPointerUp: (event) => {
      const instance = getInstance()
      if (!active || event.pointerId !== active.pointerId) return

      const current = active
      cancel(current.pointerId)

      if (current.kind === 'root') {
        void instance.commands.mindmap.moveRoot({
          nodeId: current.treeId,
          position: current.position
        })
        return
      }

      if (!current.drop) return
      void instance.commands.mindmap.moveDrop({
        id: current.treeId,
        nodeId: current.nodeId,
        drop: {
          parentId: current.drop.parentId,
          index: current.drop.index,
          side: current.drop.side
        },
        origin: {
          parentId: current.originParentId,
          index: current.originIndex
        },
        nodeSize: instance.config.mindmapNodeSize,
        layout: current.layout
      })
    },
    onWindowPointerCancel: (event) => {
      if (!active || event.pointerId !== active.pointerId) return
      cancel(active.pointerId)
    },
    onWindowBlur: () => {
      cancel()
    },
    onWindowKeyDown: (event) => {
      if (event.key !== 'Escape') return
      cancel()
    }
  }
}
