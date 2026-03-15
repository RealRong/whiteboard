import { createValueStore } from '@whiteboard/core/runtime'
import {
  applySelection,
  resolveSelectionMode
} from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPanDriver } from '../../../../runtime/interaction'
import type { InternalWhiteboardInstance } from '../../../../runtime/instance/types'
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
  instance: InternalWhiteboardInstance
) => {
  let active: ActiveDrag | null = null
  let interactionToken: ReturnType<typeof instance.interaction.tryStart> | null = null
  const pointer = createValueStore<number | null>(null)
  const pan = createPanDriver({
    viewport: instance.viewport,
    enabled: () => instance.interaction.current()?.mode === 'node-drag',
    onFrame: (input) => {
      updatePreview(input)
    }
  })

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clear = (pointerId?: number) => {
    if (
      pointerId !== undefined
      && active
      && active.pointerId !== pointerId
    ) {
      return
    }

    const previousInteractionToken = interactionToken
    active = null
    interactionToken = null
    pan.stop()
    pointer.set(null)
    instance.draft.node.clear()
    instance.draft.guides.clear()

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
      snapEnabled: instance.view.tool.get() === 'select',
      allowCross: active.allowCross,
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

      if (!instance.read.container.hasNode(nodeId)) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
      }

      const currentSelectedNodeIds = instance.read.container.filterNodeIds(
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

      const nextInteractionToken = instance.interaction.tryStart({
        mode: 'node-drag',
        cancel: () => clear(event.pointerId),
        pointerId: event.pointerId
      })
      if (!nextInteractionToken) return

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
      interactionToken = nextInteractionToken
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

      active.allowCross = event.altKey
      pan.update(event)
      updatePreview(event)
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
