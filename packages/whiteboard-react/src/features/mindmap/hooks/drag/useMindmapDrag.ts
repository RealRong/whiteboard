import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance as useInstance, useView } from '../../../../runtime/hooks'
import { interactionLock } from '../../../../runtime/interaction/interactionLock'
import { createSignal } from '../../../../runtime/interaction/signal'
import { useWindowPointerSession } from '../../../../runtime/interaction/useWindowPointerSession'
import {
  resolveNextMindmapDragSession,
  resolveRootDragSession,
  resolveSubtreeDragSession,
  toDragView,
  type MindmapDragSession
} from './math'

type ActiveMindmapDragSession = MindmapDragSession

export const useMindmapDrag = () => {
  const instance = useInstance()
  const activeRef = useRef<ActiveMindmapDragSession | null>(null)
  const tokenRef = useRef<ReturnType<typeof instance.interaction.tryStart> | null>(null)
  const lockTokenRef = useRef<ReturnType<typeof interactionLock.tryAcquire> | null>(null)
  const pointerRef = useRef(createSignal<number | null>(null))

  const cancel = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (!active) {
      return
    }

    if (pointerId !== undefined && active.pointerId !== pointerId) {
      return
    }

    const token = tokenRef.current
    const lockToken = lockTokenRef.current
    activeRef.current = null
    tokenRef.current = null
    lockTokenRef.current = null
    pointerRef.current.set(null)
    instance.draft.mindmap.clear()

    if (lockToken) {
      interactionLock.release(instance, lockToken)
    }

    if (token) {
      instance.interaction.finish(token)
    }
  }, [instance])

  const pointerId = useView(pointerRef.current)

  useWindowPointerSession({
    pointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      const { world } = instance.viewport.pointer(event)
      const next = resolveNextMindmapDragSession({
        active,
        world,
        treeView:
          active.kind === 'subtree'
            ? instance.read.mindmap.get(active.treeId)
            : undefined
      })
      activeRef.current = next
      instance.draft.mindmap.write(toDragView(next))
    },
    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      cancel(active.pointerId)

      if (active.kind === 'root') {
        void instance.commands.mindmap.moveRoot({
          nodeId: active.treeId,
          position: active.position
        })
        return
      }

      if (!active.drop) {
        return
      }

      void instance.commands.mindmap.moveDrop({
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
    },
    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      cancel(active.pointerId)
    },
    onBlur: () => {
      cancel()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') {
        return
      }

      cancel()
    }
  })

  useEffect(() => () => {
    cancel()
  }, [cancel])

  return {
    handleMindmapNodePointerDown: (
      event: ReactPointerEvent<HTMLDivElement>,
      treeId: NodeId,
      nodeId: MindmapNodeId
    ) => {
      if (event.button !== 0) {
        return
      }

      if (activeRef.current) {
        return
      }

      if (
        event.target instanceof Element
        && event.target.closest('[data-selection-ignore]')
      ) {
        return
      }

      const treeView = instance.read.mindmap.get(treeId)
      if (!treeView) {
        return
      }

      const lockToken = interactionLock.tryAcquire(instance, 'mindmapDrag', event.pointerId)
      if (!lockToken) {
        return
      }

      const token = instance.interaction.tryStart('mindmap-drag', () => cancel(event.pointerId))
      if (!token) {
        interactionLock.release(instance, lockToken)
        return
      }

      const { world } = instance.viewport.pointer(event)
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
        instance.interaction.finish(token)
        interactionLock.release(instance, lockToken)
        return
      }

      activeRef.current = next
      tokenRef.current = token
      lockTokenRef.current = lockToken
      pointerRef.current.set(event.pointerId)
      instance.draft.mindmap.write(toDragView(next))
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
