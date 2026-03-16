import {
  applySelection,
  resolveSelectionMode
} from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InternalInstance } from '../../../../runtime/instance'
import {
  filterContainerNodeIds,
  hasContainerNode
} from '../../../../runtime/state'
import {
  buildNodeDragState,
  resolveNodeDragCommit,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from './math'

type ActiveDrag = NodeDragRuntimeState & {
  pointerId: number
  allowCross: boolean
}

export const createNodeDragSession = (
  instance: InternalInstance
) => {
  let active: ActiveDrag | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clear = () => {
    active = null
    session = null
    instance.internals.node.session.clear()
    instance.internals.node.guides.clear()
  }

  const commit = (draft: ActiveDrag) => {
    const updates = resolveNodeDragCommit({
      draft,
      nodes: readCanvasNodes(),
      config: instance.config
    })
    if (!updates.length) {
      return
    }

    void instance.commands.node.updateMany(updates)
  }

  const updatePreview = (input: {
    clientX: number
    clientY: number
  }) => {
    if (!active) {
      return
    }

    const preview = resolveNodeDragPreview({
      active,
      world: instance.viewport.pointer(input).world,
      zoom: instance.viewport.get().zoom,
      snapEnabled: instance.state.tool.get() === 'select',
      allowCross: active.allowCross,
      nodes: readCanvasNodes(),
      config: instance.config,
      readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
    })

    active.last = preview.position
    active.hoveredContainerId = preview.hoveredContainerId

    instance.internals.node.session.write({
      patches: preview.patches,
      hoveredContainerId: preview.hoveredContainerId
    })
    instance.internals.node.guides.write(preview.guides)
  }

  return {
    cancel: () => {
      if (session) {
        session.cancel()
        return
      }
      clear()
    },
    handleNodePointerDown: (
      nodeId: NodeId,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (active) return
      if (instance.state.tool.get() !== 'select') return

      const nodeRect = instance.read.index.node.get(nodeId)
      if (!nodeRect) return

      let container = instance.state.container.get()
      if (!hasContainerNode(container, nodeId)) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
        container = instance.state.container.get()
      }

      const currentSelectedNodeIds = filterContainerNodeIds(
        container,
        instance.state.selection.get().target.nodeIds
      )
      const nextSelectedNodeIds = currentSelectedNodeIds.includes(nodeId)
        ? currentSelectedNodeIds
        : [...applySelection(
          new Set(currentSelectedNodeIds),
          [nodeId],
          resolveSelectionMode(event)
        )]

      if (!nextSelectedNodeIds.includes(nodeId)) {
        instance.commands.selection.select(nextSelectedNodeIds, 'replace')
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (nodeRect.node.locked) {
        if (
          nextSelectedNodeIds.length !== currentSelectedNodeIds.length
          || nextSelectedNodeIds.some((selectedNodeId: NodeId, index: number) => selectedNodeId !== currentSelectedNodeIds[index])
        ) {
          instance.commands.selection.select(nextSelectedNodeIds, 'replace')
        }
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const drag = buildNodeDragState({
        nodes: readCanvasNodes(),
        anchorId: nodeRect.node.id,
        anchorType: nodeRect.node.type,
        startWorld: instance.viewport.pointer(event).world,
        origin: {
          x: nodeRect.node.position.x,
          y: nodeRect.node.position.y
        },
        size: {
          width: nodeRect.rect.width,
          height: nodeRect.rect.height
        },
        selectedNodeIds: nextSelectedNodeIds
      })
      if (!drag.members.length) return

      const nextSession = instance.interaction.start({
        mode: 'node-drag',
        pointerId: event.pointerId,
        capture: event.currentTarget,
        pan: {
          frame: (pointer) => {
            updatePreview(pointer)
          }
        },
        cleanup: clear,
        move: (event, session) => {
          if (!active) {
            return
          }

          active.allowCross = event.altKey
          session.pan(event)
          updatePreview(event)
        },
        up: (_event, session) => {
          if (!active) {
            return
          }

          commit(active)
          session.finish()
        }
      })
      if (!nextSession) return

      if (
        nextSelectedNodeIds.length !== currentSelectedNodeIds.length
        || nextSelectedNodeIds.some((selectedNodeId: NodeId, index: number) => selectedNodeId !== currentSelectedNodeIds[index])
      ) {
        instance.commands.selection.select(nextSelectedNodeIds, 'replace')
      }

      active = {
        pointerId: event.pointerId,
        allowCross: event.altKey,
        ...drag
      }
      session = nextSession
      instance.internals.node.session.clear()
      instance.internals.node.guides.clear()

      event.preventDefault()
      event.stopPropagation()
    }
  }
}
