import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { MindmapNodeId, NodeId, Point } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../../common/interaction/useWindowPointerSession'
import type { MindmapWriter } from '../../../transient'
import {
  resolveNextMindmapDragSession,
  resolveRootDragSession,
  resolveSubtreeDragSession,
  toDragView,
  type MindmapDragSession
} from './math'

type ActiveMindmapDragSession = MindmapDragSession & {
  lockToken: InteractionLockToken
}

const readPointerWorld = (
  instance: ReturnType<typeof useInstance>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

export const useMindmapDrag = (
  mindmap: MindmapWriter
) => {
  const instance = useInstance()
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveMindmapDragSession | null>(null)

  const clearActive = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (!active) return
    if (pointerId !== undefined && active.pointerId !== pointerId) return

    activeRef.current = null
    setActivePointerId(null)
    mindmap.clear()
    interactionLock.release(instance, active.lockToken)
  }, [instance, mindmap])

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
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
      activeRef.current = {
        ...next,
        lockToken: active.lockToken
      }
      mindmap.write(toDragView(next))
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) return

      clearActive(active.pointerId)

      if (active.kind === 'root') {
        void instance.commands.mindmap.moveRoot({
          nodeId: active.treeId,
          position: active.position
        })
        return
      }

      if (!active.drop) return
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
      if (!active || event.pointerId !== active.pointerId) return
      clearActive(active.pointerId)
    },

    onBlur: () => {
      clearActive()
    },

    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clearActive()
    }
  })

  const handleMindmapNodePointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => {
    if (event.button !== 0) return
    if (activeRef.current) return
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

    activeRef.current = {
      ...next,
      lockToken
    }
    setActivePointerId(event.pointerId)
    mindmap.write(toDragView(next))
    event.preventDefault()
    event.stopPropagation()
  }, [instance, mindmap])

  return {
    cancelMindmapDragSession: clearActive,
    handleMindmapNodePointerDown
  }
}
