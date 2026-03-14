import { useCallback, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import { getRectCenter } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode,
  type TransformHandle
} from '@whiteboard/core/node'
import type { NodeId, NodePatch, Point } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'
import {
  buildNodeDragState,
  resolveNodeDragCommit,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from './drag/math'
import {
  resolveGroupResizePadding,
  resolveResizeCommitPatch,
  resolveResizeDrag,
  resolveResizePreview,
  resolveRotatePreview,
  type ResizeDragState,
  type RotateDragState
} from './transform/math'

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
  instance: ReturnType<typeof useInstance>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

export const useNodeInteractions = () => {
  const instance = useInstance()
  const { node, guides } = instance.draft
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const activeRef = useRef<ActiveInteraction | null>(null)

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clearActive = useCallback((pointerId?: number) => {
    const active = activeRef.current
    if (
      pointerId !== undefined
      && active
      && (active.kind === 'drag'
        ? active.pointerId !== pointerId
        : active.drag.pointerId !== pointerId)
    ) {
      return
    }

    activeRef.current = null
    setActivePointerId(null)
    instance.commands.session.end()
    node.clear()
    guides.clear()
    if (!active) return
    interactionLock.release(instance, active.lockToken)
  }, [guides, instance, node])

  const commitDrag = useCallback((draft: ActiveDrag) => {
    const updates = resolveNodeDragCommit({
      draft,
      nodes: readCanvasNodes(),
      config: instance.config
    })
    if (!updates.length) return
    void instance.commands.node.updateMany(updates)
  }, [instance])

  const commitTransform = useCallback((active: ActiveTransform) => {
    const node = instance.read.index.node.byId(active.nodeId)?.node
    if (!node) return

    if (active.drag.mode === 'resize') {
      const update = active.drag.lastUpdate
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
      void instance.commands.node.update(active.nodeId, patch)
      return
    }

    if (typeof active.drag.currentRotation !== 'number') return
    const previousRotation = node.rotation ?? 0
    if (previousRotation === active.drag.currentRotation) return
    void instance.commands.node.update(active.nodeId, {
      rotation: active.drag.currentRotation
    })
  }, [instance.commands.node, instance.read.index])

  const handleNodePointerDown = useCallback((
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return
    if (activeRef.current) return
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
        || nextSelectedNodeIds.some((selectedNodeId, index) => selectedNodeId !== currentSelectedNodeIds[index])
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
      || nextSelectedNodeIds.some((selectedNodeId, index) => selectedNodeId !== currentSelectedNodeIds[index])
    ) {
      instance.commands.selection.select(nextSelectedNodeIds, 'replace')
    }

    activeRef.current = {
      kind: 'drag',
      lockToken,
      pointerId: event.pointerId,
      ...drag
    }
    setActivePointerId(event.pointerId)
    instance.commands.session.beginNodeDrag()
    node.clear()
    guides.clear()

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ignore capture errors, window listeners still handle session cleanup.
    }
    event.preventDefault()
    event.stopPropagation()
  }, [guides, instance, node])

  const handleNodeDoubleClick = useCallback((
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => {
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
  }, [instance])

  const handleTransformPointerDown = useCallback((
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return
    if (activeRef.current) return
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

    activeRef.current = {
      kind: 'transform',
      nodeId,
      lockToken,
      drag
    }
    setActivePointerId(event.pointerId)
    instance.commands.session.beginNodeTransform()
    node.clear()
    guides.clear()

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ignore capture errors, window listeners still handle session cleanup.
    }
    event.preventDefault()
    event.stopPropagation()
  }, [guides, instance, node])

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const active = activeRef.current
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

        node.write({
          patches: preview.patches,
          hoveredContainerId: preview.hoveredContainerId
        })
        guides.write(preview.guides)
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
        node.write({
          patches: [{
            id: active.nodeId,
            position: preview.update.position,
            size: preview.update.size
          }]
        })
        guides.write(preview.guides)
        return
      }

      const rotation = resolveRotatePreview({
        drag: active.drag,
        currentPoint: readPointerWorld(instance, event),
        shiftKey: event.shiftKey
      })
      active.drag.currentRotation = rotation
      node.write({
        patches: [{
          id: active.nodeId,
          rotation
        }]
      })
      guides.write([])
    },

    onPointerUp: (event) => {
      const active = activeRef.current
      if (!active) return

      if (active.kind === 'drag') {
        if (event.pointerId !== active.pointerId) return
        commitDrag(active)
        clearActive(active.pointerId)
        return
      }

      if (event.pointerId !== active.drag.pointerId) return
      commitTransform(active)
      clearActive(active.drag.pointerId)
    },

    onPointerCancel: (event) => {
      const active = activeRef.current
      if (!active) return
      if (
        active.kind === 'drag'
          ? event.pointerId !== active.pointerId
          : event.pointerId !== active.drag.pointerId
      ) {
        return
      }
      clearActive(event.pointerId)
    },

    onBlur: () => {
      clearActive()
    },

    onKeyDown: (event) => {
      if (event.key !== 'Escape') return
      clearActive()
    }
  })

  return {
    cancelNodeInteractionSession: clearActive,
    handleNodeDoubleClick,
    handleNodePointerDown,
    handleTransformPointerDown
  }
}
