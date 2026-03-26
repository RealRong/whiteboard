import {
  createRootDrag,
  createSubtreeDrag,
  projectMindmapDrag,
  type MindmapDragSession
} from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance } from '../../../../runtime/hooks'
import type { MindmapDown } from '../../../../runtime/input/pointer'
import type { MindmapDragState } from '../../session/drag'

type ActiveMindmapDragSession = MindmapDragSession

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

export const useMindmapDrag = () => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveMindmapDragSession | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const clear = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.mindmapDrag.clear()
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
    const next = projectMindmapDrag({
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
    instance.internals.mindmapDrag.write(toMindmapDragState(next))
  }, [instance])

  useEffect(() => () => {
    cancel()
  }, [cancel])

  const start = useCallback((
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
          instance.commands.mindmap.moveRoot({
            nodeId: active.treeId,
            position: active.position
          })
          session.finish()
          return
        }

        if (active.drop) {
          instance.commands.mindmap.moveDrop({
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
    if (!nextSession) {
      return false
    }

    const { world } = instance.viewport.pointer(event)
    const position = treeView.node.position
    if (!position) {
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

    activeRef.current = {
      ...next
    }
    sessionRef.current = nextSession
    instance.internals.mindmapDrag.write(toMindmapDragState(next))
    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clear, instance, updatePreview])

  return {
    down: (
      input: MindmapDown
    ) => {
      if (activeRef.current) {
        return false
      }

      return start(
        input.capture,
        input.event,
        input.pick.treeId,
        input.pick.nodeId
      )
    }
  }
}
