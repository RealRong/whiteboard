import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance as useInstance } from '../../../../runtime/hooks'
import {
  resolveNextMindmapDragSession,
  resolveRootDragSession,
  resolveSubtreeDragSession,
  toMindmapDragState,
  type MindmapDragSession
} from './math'

type ActiveMindmapDragSession = MindmapDragSession

export const useMindmapDrag = () => {
  const instance = useInstance()
  const activeRef = useRef<ActiveMindmapDragSession | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const clear = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.mindmap.drag.clear()
  }, [instance])

  const cancel = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clear()
  }, [clear])

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
    activeRef.current = {
      ...next
    }
    instance.internals.mindmap.drag.write(toMindmapDragState(next))
  }, [instance])

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

      const nextSession = instance.interaction.start({
        mode: 'mindmap-drag',
        pointerId: event.pointerId,
        capture: event.currentTarget,
        pan: {
          frame: (pointer) => {
            updatePreview(pointer)
          }
        },
        cleanup: clear,
        move: (event, session) => {
          if (!activeRef.current) {
            return
          }

          session.pan(event)
          updatePreview(event)
        },
        up: (_event, session) => {
          const active = activeRef.current
          if (!active) {
            return
          }

          if (active.kind === 'root') {
            void instance.commands.mindmap.moveRoot({
              nodeId: active.treeId,
              position: active.position
            })
            session.finish()
            return
          }

          if (active.drop) {
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
          }

          session.finish()
        }
      })
      if (!nextSession) return

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
        nextSession.cancel()
        return
      }

      activeRef.current = {
        ...next
      }
      sessionRef.current = nextSession
      instance.internals.mindmap.drag.write(toMindmapDragState(next))
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
