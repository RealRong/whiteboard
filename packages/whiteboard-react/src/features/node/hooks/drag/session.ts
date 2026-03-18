import {
  applySelection,
  resolveSelectionMode
} from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  isEditableTarget,
  isInputIgnoredTarget,
  isNodeEditableDisplayTarget,
  isSelectionIgnoredTarget
} from '../../../../canvas/target'
import type { InternalInstance } from '../../../../runtime/instance'
import {
  filterNodeIds,
  hasNode,
  leave
} from '../../../../runtime/container'
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

type PendingDrag = {
  pointerId: number
  capture: HTMLDivElement
  nodeRect: NonNullable<ReturnType<InternalInstance['read']['index']['node']['get']>>
  startClientX: number
  startClientY: number
  startWorld: {
    x: number
    y: number
  }
  nextSelectedNodeIds: readonly NodeId[]
}

export const createNodeDragSession = (
  instance: InternalInstance
) => {
  let active: ActiveDrag | null = null
  let pending: PendingDrag | null = null
  let session: ReturnType<typeof instance.interaction.start> = null
  let releasePending = () => {}

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const hasSelectionChanged = (
    currentSelectedNodeIds: readonly NodeId[],
    nextSelectedNodeIds: readonly NodeId[]
  ) => (
    nextSelectedNodeIds.length !== currentSelectedNodeIds.length
    || nextSelectedNodeIds.some((selectedNodeId: NodeId, index: number) => selectedNodeId !== currentSelectedNodeIds[index])
  )

  const clearPending = () => {
    releasePending()
    releasePending = () => {}
    pending = null
  }

  const clear = () => {
    clearPending()
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

    instance.commands.node.updateMany(updates)
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
      snapEnabled: instance.read.tool.is('select'),
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

  const startDrag = (
    moveEvent: PointerEvent
  ) => {
    if (!pending) {
      return
    }

    const drag = buildNodeDragState({
      nodes: readCanvasNodes(),
      anchorId: pending.nodeRect.node.id,
      anchorType: pending.nodeRect.node.type,
      startWorld: pending.startWorld,
      origin: {
        x: pending.nodeRect.node.position.x,
        y: pending.nodeRect.node.position.y
      },
      size: {
        width: pending.nodeRect.rect.width,
        height: pending.nodeRect.rect.height
      },
      selectedNodeIds: pending.nextSelectedNodeIds
    })
    if (!drag.members.length) {
      clearPending()
      return
    }

    const nextSession = instance.interaction.start({
      mode: 'node-drag',
      pointerId: pending.pointerId,
      capture: pending.capture,
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
    if (!nextSession) {
      clearPending()
      return
    }

    active = {
      pointerId: pending.pointerId,
      allowCross: moveEvent.altKey,
      ...drag
    }
    session = nextSession
    clearPending()
    instance.internals.node.session.clear()
    instance.internals.node.guides.clear()
    nextSession.pan(moveEvent)
    updatePreview(moveEvent)

    if (moveEvent.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const bindPending = () => {
    if (typeof window === 'undefined') {
      return
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!pending || moveEvent.pointerId !== pending.pointerId) {
        return
      }

      if (instance.interaction.mode.get() !== 'idle') {
        clearPending()
        return
      }

      const minDragDistance = instance.config.node.selectionMinDragDistance
      const dx = Math.abs(moveEvent.clientX - pending.startClientX)
      const dy = Math.abs(moveEvent.clientY - pending.startClientY)
      if (dx < minDragDistance && dy < minDragDistance) {
        return
      }

      startDrag(moveEvent)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (!pending || upEvent.pointerId !== pending.pointerId) {
        return
      }

      clearPending()
    }

    const onPointerCancel = (cancelEvent: PointerEvent) => {
      if (!pending || cancelEvent.pointerId !== pending.pointerId) {
        return
      }

      clearPending()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)

    releasePending = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
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
      if (pending) return
      if (active) return
      if (instance.interaction.mode.get() !== 'idle') return
      if (!instance.read.tool.is('select')) return
      if (
        isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
        || isSelectionIgnoredTarget(event.target)
        || isNodeEditableDisplayTarget(event.target)
      ) {
        return
      }

      const nodeRect = instance.read.index.node.get(nodeId)
      if (!nodeRect) return

      let container = instance.state.container.get()
      if (!hasNode(container, nodeId)) {
        leave(instance)
        container = instance.state.container.get()
      }

      const currentSelectedNodeIds = filterNodeIds(
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
        instance.commands.selection.replace(nextSelectedNodeIds)
        event.stopPropagation()
        return
      }

      if (nodeRect.node.locked) {
        if (hasSelectionChanged(currentSelectedNodeIds, nextSelectedNodeIds)) {
          instance.commands.selection.replace(nextSelectedNodeIds)
        }
        event.stopPropagation()
        return
      }

      if (hasSelectionChanged(currentSelectedNodeIds, nextSelectedNodeIds)) {
        instance.commands.selection.replace(nextSelectedNodeIds)
      }

      pending = {
        pointerId: event.pointerId,
        capture: event.currentTarget,
        nodeRect,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWorld: instance.viewport.pointer(event).world,
        nextSelectedNodeIds
      }
      bindPending()
      event.stopPropagation()
    }
  }
}
