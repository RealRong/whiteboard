import { createValueStore } from '@whiteboard/core/runtime'
import {
  applySelection,
  resolveSelectionMode
} from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InternalWhiteboardInstance } from '../../../../runtime/instance/types'
import { interactionLock } from '../../../../runtime/interaction/interactionLock'
import {
  buildNodeDragState,
  resolveNodeDragCommit,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from './math'

type ActiveDrag = NodeDragRuntimeState & {
  pointerId: number
}

export const createNodeDragSession = (
  instance: InternalWhiteboardInstance
) => {
  let active: ActiveDrag | null = null
  let interactionToken: ReturnType<typeof instance.interaction.tryStart> | null = null
  let lockToken: ReturnType<typeof interactionLock.tryAcquire> | null = null
  const pointer = createValueStore<number | null>(null)

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clear = (pointerId?: number) => {
    if (
      pointerId !== undefined
      && active
      && active.pointerId !== pointerId
    ) {
      return
    }

    const previousLockToken = lockToken
    const previousInteractionToken = interactionToken
    active = null
    interactionToken = null
    lockToken = null
    pointer.set(null)
    instance.draft.node.clear()
    instance.draft.guides.clear()

    if (previousLockToken) {
      interactionLock.release(instance, previousLockToken)
    }

    if (previousInteractionToken) {
      instance.interaction.finish(previousInteractionToken)
    }
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

  return {
    pointer,
    cancel: clear,
    handleNodePointerDown: (
      nodeId: NodeId,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (active) return
      if (instance.view.tool.get() !== 'select') return

      const nodeRect = instance.read.index.node.byId(nodeId)
      if (!nodeRect) return

      if (!instance.read.scope.hasNode(nodeId)) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
      }

      const currentSelectedNodeIds = instance.read.scope.filterNodeIds(
        instance.read.selection.nodeIds()
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
        start: {
          x: event.clientX,
          y: event.clientY
        },
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

      const nextLockToken = interactionLock.tryAcquire(instance, 'nodeDrag', event.pointerId)
      if (!nextLockToken) return

      const nextInteractionToken = instance.interaction.tryStart('node-drag', () => clear(event.pointerId))
      if (!nextInteractionToken) {
        interactionLock.release(instance, nextLockToken)
        return
      }

      if (
        nextSelectedNodeIds.length !== currentSelectedNodeIds.length
        || nextSelectedNodeIds.some((selectedNodeId: NodeId, index: number) => selectedNodeId !== currentSelectedNodeIds[index])
      ) {
        instance.commands.selection.select(nextSelectedNodeIds, 'replace')
      }

      active = {
        pointerId: event.pointerId,
        ...drag
      }
      interactionToken = nextInteractionToken
      lockToken = nextLockToken
      pointer.set(event.pointerId)
      instance.draft.node.clear()
      instance.draft.guides.clear()

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle session cleanup.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    onWindowPointerMove: (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      const preview = resolveNodeDragPreview({
        active,
        client: {
          x: event.clientX,
          y: event.clientY
        },
        zoom: instance.viewport.get().zoom,
        snapEnabled: instance.view.tool.get() === 'select',
        allowCross: event.altKey,
        nodes: readCanvasNodes(),
        config: instance.config,
        readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
      })

      active.last = preview.position
      active.hoveredContainerId = preview.hoveredContainerId

      instance.draft.node.write({
        patches: preview.patches,
        hoveredContainerId: preview.hoveredContainerId
      })
      instance.draft.guides.write(preview.guides)
    },
    onWindowPointerUp: (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      commit(active)
      clear(active.pointerId)
    },
    onWindowPointerCancel: (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) {
        return
      }

      clear(event.pointerId)
    },
    onWindowBlur: () => {
      clear()
    },
    onWindowKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      clear()
    }
  }
}
