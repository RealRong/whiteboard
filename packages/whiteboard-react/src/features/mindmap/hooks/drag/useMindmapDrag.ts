import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import { createValueStore } from '@whiteboard/core/runtime'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance as useInstance, useStoreValue } from '../../../../runtime/hooks'
import {
  createPanDriver,
  useWindowPointerSession
} from '../../../../runtime/interaction'
import {
  resolveNextMindmapDragSession,
  resolveRootDragSession,
  resolveSubtreeDragSession,
  toDragDraft,
  type MindmapDragSession
} from './math'

type ActiveMindmapDragSession = MindmapDragSession

export const useMindmapDrag = () => {
  const instance = useInstance()
  const activeRef = useRef<ActiveMindmapDragSession | null>(null)
  const tokenRef = useRef<ReturnType<typeof instance.interaction.tryStart> | null>(null)
  const pointerRef = useRef(createValueStore<number | null>(null))
  const panRef = useRef<ReturnType<typeof createPanDriver> | null>(null)

  const cancel = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (!active) {
      return
    }

    if (pointerId !== undefined && active.pointerId !== pointerId) {
      return
    }

    const token = tokenRef.current
    activeRef.current = null
    tokenRef.current = null
    panRef.current?.stop()
    pointerRef.current.set(null)
    instance.draft.mindmap.clear()

    if (token) {
      instance.interaction.finish(token)
    }
  }, [instance])

  const updatePreview = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = activeRef.current
    if (!active) {
      return
    }

    const { world } = instance.viewport.pointer(input)
    const next = resolveNextMindmapDragSession({
      active,
      world,
      treeView:
        active.kind === 'subtree'
          ? instance.read.mindmap.item.get(active.treeId)
          : undefined
    })
    activeRef.current = next
    instance.draft.mindmap.write(toDragDraft(next))
  }, [instance])

  if (!panRef.current) {
    panRef.current = createPanDriver({
      viewport: instance.viewport,
      enabled: () => instance.interaction.current()?.mode === 'mindmap-drag',
      onFrame: updatePreview
    })
  }

  const pointerId = useStoreValue(pointerRef.current)

  useWindowPointerSession({
    pointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      panRef.current?.update(event)
      updatePreview(event)
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

      const treeView = instance.read.mindmap.item.get(treeId)
      if (!treeView) {
        return
      }

      const token = instance.interaction.tryStart({
        mode: 'mindmap-drag',
        cancel: () => cancel(event.pointerId),
        pointerId: event.pointerId
      })
      if (!token) return

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
        return
      }

      activeRef.current = next
      tokenRef.current = token
      pointerRef.current.set(event.pointerId)
      instance.draft.mindmap.write(toDragDraft(next))
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
