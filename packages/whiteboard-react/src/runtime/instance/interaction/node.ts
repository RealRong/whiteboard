import { getRectCenter } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type TransformHandle
} from '@whiteboard/core/node'
import type { NodeId, NodePatch, Point } from '@whiteboard/core/types'
import { interactionLock, type InteractionLockToken } from '../../interaction/interactionLock'
import type { InternalWhiteboardInstance } from '../types'
import {
  buildNodeDragState,
  resolveNodeDragCommit,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from '../../../features/node/hooks/drag/math'
import {
  resolveGroupResizePadding,
  resolveResizeCommitPatch,
  resolveResizeDrag,
  resolveResizePreview,
  resolveRotatePreview,
  type ResizeDragState,
  type RotateDragState
} from '../../../features/node/hooks/transform/math'
import { createSignal } from './signal'
import type {
  ActiveInteractionSessionKind,
  InteractionSession,
  NodeInteractionRuntime
} from './types'

const DOUBLE_CLICK_IGNORE_SELECTOR = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  '[data-input-role]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

type ActiveDrag = NodeDragRuntimeState & {
  kind: 'drag'
  lockToken: InteractionLockToken
  pointerId: number
}

type ActiveTransform = {
  kind: 'transform'
  nodeId: NodeId
  lockToken: InteractionLockToken
  drag: ResizeDragState | RotateDragState
}

type ActiveInteraction = ActiveDrag | ActiveTransform

const readPointerWorld = (
  instance: InternalWhiteboardInstance,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

export const createNodeInteractionRuntime = (
  getInstance: () => InternalWhiteboardInstance,
  lifecycle: {
    begin: (kind: ActiveInteractionSessionKind) => void
    end: () => void
  }
): NodeInteractionRuntime => {
  let active: ActiveInteraction | null = null
  const pointer = createSignal<number | null>(null)

  const readCanvasNodes = () => {
    const instance = getInstance()
    return instance.read.index.node.all().map((entry) => entry.node)
  }

  const clear = (pointerId?: number) => {
    const instance = getInstance()
    if (
      pointerId !== undefined
      && active
      && (active.kind === 'drag'
        ? active.pointerId !== pointerId
        : active.drag.pointerId !== pointerId)
    ) {
      return
    }

    const previous = active
    active = null
    pointer.set(null)
    lifecycle.end()
    instance.draft.node.clear()
    instance.draft.guides.clear()
    if (!previous) return
    interactionLock.release(instance, previous.lockToken)
  }

  const commitDrag = (draft: ActiveDrag) => {
    const instance = getInstance()
    const updates = resolveNodeDragCommit({
      draft,
      nodes: readCanvasNodes(),
      config: instance.config
    })
    if (!updates.length) return
    void instance.commands.node.updateMany(updates)
  }

  const commitTransform = (next: ActiveTransform) => {
    const instance = getInstance()
    const node = instance.read.index.node.byId(next.nodeId)?.node
    if (!node) return

    if (next.drag.mode === 'resize') {
      const update = next.drag.lastUpdate
      if (!update) return
      let patch: NodePatch | undefined = resolveResizeCommitPatch(node, update)
      const padding = resolveGroupResizePadding({
        group: node,
        update,
        nodes: readCanvasNodes(),
        nodeSize: instance.config.nodeSize
      })
      if (padding !== undefined) {
        patch ??= {}
        patch.data = {
          ...(node.data ?? {}),
          autoFit: 'manual',
          padding
        }
      } else if (node.type === 'group') {
        patch ??= {}
        patch.data = {
          ...(node.data ?? {}),
          autoFit: 'manual'
        }
      }
      if (!patch) return
      void instance.commands.node.update(next.nodeId, patch)
      return
    }

    if (typeof next.drag.currentRotation !== 'number') return
    const previousRotation = node.rotation ?? 0
    if (previousRotation === next.drag.currentRotation) return
    void instance.commands.node.update(next.nodeId, {
      rotation: next.drag.currentRotation
    })
  }

  return {
    pointer,
    cancel: clear,
    handleNodePointerDown: (nodeId, event) => {
      const instance = getInstance()
      if (event.button !== 0) return
      if (active) return
      if (instance.state.tool.get() !== 'select') return

      const nodeRect = instance.read.index.node.byId(nodeId)
      if (!nodeRect) return

      if (!instance.read.container.hasNode(nodeId)) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
      }

      const currentSelectedNodeIds = instance.read.container.filterNodeIds(
        instance.state.selection.getNodeIds()
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

      const lockToken = interactionLock.tryAcquire(instance, 'nodeDrag', event.pointerId)
      if (!lockToken) return

      if (
        nextSelectedNodeIds.length !== currentSelectedNodeIds.length
        || nextSelectedNodeIds.some((selectedNodeId: NodeId, index: number) => selectedNodeId !== currentSelectedNodeIds[index])
      ) {
        instance.commands.selection.select(nextSelectedNodeIds, 'replace')
      }

      active = {
        kind: 'drag',
        lockToken,
        pointerId: event.pointerId,
        ...drag
      }
      pointer.set(event.pointerId)
      lifecycle.begin('node-drag')
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
    handleNodeDoubleClick: (nodeId, event) => {
      const instance = getInstance()
      if (instance.state.tool.get() !== 'select') return
      const target = event.target
      if (target instanceof Element && target.closest(DOUBLE_CLICK_IGNORE_SELECTOR)) {
        return
      }

      const nodeEntry = instance.read.index.node.byId(nodeId)
      if (!nodeEntry || nodeEntry.node.type !== 'group') return

      instance.commands.selection.clear()
      instance.commands.container.enter(nodeId)
      event.preventDefault()
      event.stopPropagation()
    },
    handleTransformPointerDown: (nodeId, handle, event) => {
      const instance = getInstance()
      if (event.button !== 0) return
      if (active) return
      if (instance.state.tool.get() !== 'select') return

      const nodeRect = instance.read.index.node.byId(nodeId)
      if (!nodeRect || nodeRect.node.locked) return

      let drag: ResizeDragState | RotateDragState

      if (handle.kind === 'resize') {
        if (!handle.direction) return
        drag = resolveResizeDrag({
          pointerId: event.pointerId,
          handle: handle.direction,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation,
          startScreen: {
            x: event.clientX,
            y: event.clientY
          }
        })
      } else if (handle.kind === 'rotate') {
        const center = getRectCenter(nodeRect.rect)
        const world = readPointerWorld(instance, event)
        drag = {
          mode: 'rotate',
          pointerId: event.pointerId,
          startAngle: Math.atan2(world.y - center.y, world.x - center.x),
          startRotation: nodeRect.rotation,
          currentRotation: nodeRect.rotation,
          center
        }
      } else {
        return
      }

      const lockToken = interactionLock.tryAcquire(instance, 'nodeTransform', event.pointerId)
      if (!lockToken) return

      active = {
        kind: 'transform',
        nodeId,
        lockToken,
        drag
      }
      pointer.set(event.pointerId)
      lifecycle.begin('node-transform')
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
    onWindowPointerMove: (event) => {
      const instance = getInstance()
      if (!active) return

      if (active.kind === 'drag') {
        if (event.pointerId !== active.pointerId) return

        const preview = resolveNodeDragPreview({
          active,
          client: {
            x: event.clientX,
            y: event.clientY
          },
          zoom: instance.viewport.get().zoom,
          snapEnabled: instance.state.tool.get() === 'select',
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
        return
      }

      if (event.pointerId !== active.drag.pointerId) return

      if (active.drag.mode === 'resize') {
        const preview = resolveResizePreview({
          activeTool: instance.state.tool.get(),
          drag: active.drag,
          currentScreen: {
            x: event.clientX,
            y: event.clientY
          },
          zoom: instance.viewport.get().zoom,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          nodeId: active.nodeId,
          config: instance.config,
          readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
        })

        active.drag.lastUpdate = preview.update
        instance.draft.node.write({
          patches: [{
            id: active.nodeId,
            position: preview.update.position,
            size: preview.update.size
          }]
        })
        instance.draft.guides.write(preview.guides)
        return
      }

      const rotation = resolveRotatePreview({
        drag: active.drag,
        currentPoint: readPointerWorld(instance, event),
        shiftKey: event.shiftKey
      })
      active.drag.currentRotation = rotation
      instance.draft.node.write({
        patches: [{
          id: active.nodeId,
          rotation
        }]
      })
      instance.draft.guides.write([])
    },
    onWindowPointerUp: (event) => {
      if (!active) return

      if (active.kind === 'drag') {
        if (event.pointerId !== active.pointerId) return
        commitDrag(active)
        clear(active.pointerId)
        return
      }

      if (event.pointerId !== active.drag.pointerId) return
      commitTransform(active)
      clear(active.drag.pointerId)
    },
    onWindowPointerCancel: (event) => {
      if (!active) return
      if (
        active.kind === 'drag'
          ? event.pointerId !== active.pointerId
          : event.pointerId !== active.drag.pointerId
      ) {
        return
      }
      clear(event.pointerId)
    },
    onWindowBlur: () => {
      clear()
    },
    onWindowKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clear()
    }
  }
}
