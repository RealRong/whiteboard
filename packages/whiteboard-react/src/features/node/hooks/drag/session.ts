import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { MarqueeSession } from '../../../../canvas/Marquee'
import {
  isCanvasContentIgnoredTarget,
  isEditableTarget,
  isInputIgnoredTarget,
  isSelectionIgnoredTarget,
  readEditableFieldTarget,
  readElementNodeId
} from '../../../../canvas/target'
import type { EditField } from '../../../../runtime/edit'
import type { InternalInstance } from '../../../../runtime/instance'
import type { NodePressPhase } from '../../session/runtime'
import {
  enter,
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
import { GestureTuning } from '../../../../runtime/interaction'
import { getNodeScene } from '../../scene'

type ActiveDrag = NodeDragRuntimeState & {
  pointerId: number
  allowCross: boolean
}

type PendingPress = {
  pointerId: number
  capture: Element
  nodeRect: NonNullable<ReturnType<InternalInstance['read']['index']['node']['get']>>
  start: {
    clientX: number
    clientY: number
    world: {
      x: number
      y: number
    }
  }
  currentSelectedNodeIds: readonly NodeId[]
  clickSelectedNodeIds: readonly NodeId[]
  dragSelectedNodeIds: readonly NodeId[]
  containerNodeIds?: ReadonlySet<NodeId>
  selectionMode: SelectionMode
  phase: Exclude<NodePressPhase, 'hold'>
  holdElapsed: boolean
  holdTimer?: number
  locked: boolean
  zone: 'node' | 'body'
  field?: EditField
}

const isSingleSelectedNode = (
  instance: InternalInstance,
  nodeId: NodeId,
  currentSelectedNodeIds: readonly NodeId[]
) => (
  instance.state.selection.get().target.edgeId === undefined
  && currentSelectedNodeIds.length === 1
  && currentSelectedNodeIds[0] === nodeId
)

const isSelectedNode = (
  instance: InternalInstance,
  nodeId: NodeId,
  currentSelectedNodeIds: readonly NodeId[]
) => (
  instance.state.selection.get().target.edgeId === undefined
  && currentSelectedNodeIds.includes(nodeId)
)

export const createNodePressSession = (
  instance: InternalInstance,
  marquee: MarqueeSession
) => {
  let active: ActiveDrag | null = null
  let pending: PendingPress | null = null
  let session: ReturnType<typeof instance.interaction.start> = null
  let releasePending = () => {}

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const readMarqueeScope = (
    nodeId: NodeId,
    container: ReturnType<InternalInstance['state']['container']['get']>
  ): ReadonlySet<NodeId> | undefined => {
    const entry = instance.read.index.node.get(nodeId)
    if (!entry) {
      return container.id
        ? new Set<NodeId>(container.ids)
        : undefined
    }

    if (getNodeScene(instance.registry.get(entry.node.type)) === 'container') {
      return new Set<NodeId>(instance.read.tree.get(nodeId))
    }

    return container.id
      ? new Set<NodeId>(container.ids)
      : undefined
  }

  const hasSelectionChanged = (
    currentSelectedNodeIds: readonly NodeId[],
    nextSelectedNodeIds: readonly NodeId[]
  ) => (
    nextSelectedNodeIds.length !== currentSelectedNodeIds.length
    || nextSelectedNodeIds.some(
      (selectedNodeId: NodeId, index: number) => selectedNodeId !== currentSelectedNodeIds[index]
    )
  )

  const clearPending = () => {
    releasePending()
    releasePending = () => {}
    if (pending?.holdTimer !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(pending.holdTimer)
    }
    instance.internals.node.press.set(null)
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

  const finalizeClick = () => {
    const current = pending
    if (!current) {
      return
    }

    clearPending()

    if (current.locked) {
      if (hasSelectionChanged(current.currentSelectedNodeIds, current.clickSelectedNodeIds)) {
        instance.commands.selection.replace(current.clickSelectedNodeIds)
      }
      return
    }

    if (current.phase === 'retarget') {
      if (hasSelectionChanged(current.currentSelectedNodeIds, current.clickSelectedNodeIds)) {
        instance.commands.selection.replace(current.clickSelectedNodeIds)
      }
      return
    }

    if (current.field) {
      instance.commands.edit.start(current.nodeRect.node.id, current.field)
    }
  }

  const startDrag = (
    moveEvent: PointerEvent
  ) => {
    if (!pending) {
      return
    }

    if (pending.locked) {
      clearPending()
      return
    }

    if (hasSelectionChanged(pending.currentSelectedNodeIds, pending.dragSelectedNodeIds)) {
      instance.commands.selection.replace(pending.dragSelectedNodeIds)
    }

    const drag = buildNodeDragState({
      nodes: readCanvasNodes(),
      anchorId: pending.nodeRect.node.id,
      anchorType: pending.nodeRect.node.type,
      startWorld: pending.start.world,
      origin: {
        x: pending.nodeRect.node.position.x,
        y: pending.nodeRect.node.position.y
      },
      size: {
        width: pending.nodeRect.rect.width,
        height: pending.nodeRect.rect.height
      },
      selectedNodeIds: pending.dragSelectedNodeIds
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
      move: (event, currentSession) => {
        if (!active) {
          return
        }

        active.allowCross = event.altKey
        currentSession.pan(event)
        updatePreview(event)
      },
      up: (_event, currentSession) => {
        if (!active) {
          return
        }

        commit(active)
        currentSession.finish()
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

  const startMarquee = (
    moveEvent: PointerEvent
  ) => {
    if (!pending) {
      return
    }

    const policy =
      pending.zone === 'body' && pending.phase === 'retarget'
        ? {
            match: 'touch' as const
          }
        : {
            match: 'contain' as const,
            exclude: [pending.nodeRect.node.id]
          }

    const started = marquee.start({
      pointerId: pending.pointerId,
      capture: pending.capture,
      start: instance.viewport.pointer({
        clientX: pending.start.clientX,
        clientY: pending.start.clientY
      }),
      mode: pending.selectionMode,
      baseSelectedNodeIds: pending.currentSelectedNodeIds,
      containerNodeIds: pending.containerNodeIds,
      policy
    })
    clearPending()
    if (!started) {
      return
    }

    if (moveEvent.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const bindPending = () => {
    if (typeof window === 'undefined') {
      return
    }

    const minDragDistance = GestureTuning.dragMinDistance

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!pending || moveEvent.pointerId !== pending.pointerId) {
        return
      }

      if (instance.interaction.mode.get() !== 'idle') {
        clearPending()
        return
      }

      const dx = Math.abs(moveEvent.clientX - pending.start.clientX)
      const dy = Math.abs(moveEvent.clientY - pending.start.clientY)
      if (dx < minDragDistance && dy < minDragDistance) {
        return
      }

      if (pending.holdElapsed) {
        startMarquee(moveEvent)
        return
      }

      if (pending.zone === 'body' && pending.phase === 'retarget') {
        startMarquee(moveEvent)
        return
      }

      startDrag(moveEvent)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (!pending || upEvent.pointerId !== pending.pointerId) {
        return
      }

      if (pending.holdElapsed) {
        clearPending()
        return
      }

      if (
        pending.zone === 'body'
        || readElementNodeId(upEvent.target) === pending.nodeRect.node.id
      ) {
        finalizeClick()
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
      const selectionMode = resolveSelectionMode(event)
      const phase: Exclude<NodePressPhase, 'hold'> =
        selectionMode === 'replace' && isSingleSelectedNode(instance, nodeId, currentSelectedNodeIds)
          ? 'repeat'
          : 'retarget'
      const clickSelectedNodeIds = [
        ...applySelection(
          new Set(currentSelectedNodeIds),
          [nodeId],
          selectionMode
        )
      ]
      const dragSelectedNodeIds = currentSelectedNodeIds.includes(nodeId)
        ? currentSelectedNodeIds
        : clickSelectedNodeIds

      pending = {
        pointerId: event.pointerId,
        capture: event.currentTarget,
        nodeRect,
        start: {
          clientX: event.clientX,
          clientY: event.clientY,
          world: instance.viewport.pointer(event).world
        },
        currentSelectedNodeIds,
        clickSelectedNodeIds,
        dragSelectedNodeIds,
        containerNodeIds: readMarqueeScope(nodeRect.node.id, container),
        selectionMode,
        phase,
        holdElapsed: false,
        locked: Boolean(nodeRect.node.locked),
        zone: 'node',
        field: readEditableFieldTarget(event.target)
      }

      if (typeof window !== 'undefined') {
        pending.holdTimer = window.setTimeout(() => {
          if (!pending || pending.pointerId !== event.pointerId) {
            return
          }
          pending.holdElapsed = true
          if (pending.selectionMode === 'replace') {
            instance.commands.selection.clear()
          }
          instance.internals.node.press.set('hold')
        }, GestureTuning.holdDelay)
      }

      instance.internals.node.press.set(phase)
      bindPending()

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    },
    handleContainerBodyPointerDown: (
      nodeId: NodeId,
      capture: HTMLDivElement,
      event: PointerEvent
    ) => {
      if (event.button !== 0) return false
      if (pending) return false
      if (active) return false
      if (instance.interaction.mode.get() !== 'idle') return false
      if (!instance.read.tool.is('select')) return false

      const nodeRect = instance.read.index.node.get(nodeId)
      if (!nodeRect) return false

      const container = instance.state.container.get()
      const currentSelectedNodeIds = filterNodeIds(
        container,
        instance.state.selection.get().target.nodeIds
      )
      const selectionMode = resolveSelectionMode(event)
      const phase: Exclude<NodePressPhase, 'hold'> =
        selectionMode === 'replace' && isSelectedNode(instance, nodeId, currentSelectedNodeIds)
          ? 'repeat'
          : 'retarget'
      const clickSelectedNodeIds = [
        ...applySelection(
          new Set(currentSelectedNodeIds),
          [nodeId],
          selectionMode
        )
      ]

      pending = {
        pointerId: event.pointerId,
        capture,
        nodeRect,
        start: {
          clientX: event.clientX,
          clientY: event.clientY,
          world: instance.viewport.pointer(event).world
        },
        currentSelectedNodeIds,
        clickSelectedNodeIds,
        dragSelectedNodeIds: phase === 'repeat'
          ? currentSelectedNodeIds
          : clickSelectedNodeIds,
        containerNodeIds: readMarqueeScope(nodeRect.node.id, container),
        selectionMode,
        phase,
        holdElapsed: false,
        locked: Boolean(nodeRect.node.locked),
        zone: 'body'
      }

      if (phase === 'repeat' && typeof window !== 'undefined') {
        pending.holdTimer = window.setTimeout(() => {
          if (!pending || pending.pointerId !== event.pointerId) {
            return
          }
          pending.holdElapsed = true
          instance.commands.selection.clear()
          instance.internals.node.press.set('hold')
        }, GestureTuning.holdDelay)
      }

      instance.internals.node.press.set(phase)
      bindPending()

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
      return true
    },
    handleNodeDoubleClick: (
      nodeId: NodeId,
      event: ReactMouseEvent<HTMLDivElement>
    ) => {
      if (!instance.read.tool.is('select')) return

      if (isCanvasContentIgnoredTarget(event.target)) {
        return
      }

      if (readEditableFieldTarget(event.target)) {
        return
      }

      const nodeEntry = instance.read.index.node.get(nodeId)
      if (
        !nodeEntry
        || getNodeScene(instance.registry.get(nodeEntry.node.type)) !== 'container'
      ) {
        return
      }

      enter(instance, nodeId)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

export type NodePressSession = ReturnType<typeof createNodePressSession>
