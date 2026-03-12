import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { getRectCenter } from '@whiteboard/core/geometry'
import { resolveSelectionMode, type TransformHandle } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../common/hooks'
import { interactionLock, type InteractionLockToken } from '../../common/interaction/interactionLock'
import { useWindowPointerSession } from '../../common/interaction/useWindowPointerSession'
import type {
  GuidesWriter,
  NodeWriter,
} from '../../transient'
import {
  buildGroupChildren,
  resolveNodeDragCommit,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from './drag/math'
import {
  resolveResizeCommitPatch,
  resolveResizeDrag,
  resolveResizePreview,
  resolveRotatePreview,
  type ResizeDragState,
  type RotateDragState
} from './transform/math'

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

export const useNodeInteractions = (
  node: NodeWriter,
  guides: GuidesWriter
) => {
  const instance = useInstance()
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
      const patch = resolveResizeCommitPatch(node, update)
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
    if (instance.state.tool() !== 'select') return

    const nodeRect = instance.read.index.node.byId(nodeId)
    if (!nodeRect || nodeRect.node.locked) return

    const lockToken = interactionLock.tryAcquire(instance, 'nodeDrag', event.pointerId)
    if (!lockToken) return

    instance.commands.selection.select(
      [nodeId],
      resolveSelectionMode(event)
    )

    const origin = {
      x: nodeRect.node.position.x,
      y: nodeRect.node.position.y
    }
    const size = {
      width: nodeRect.rect.width,
      height: nodeRect.rect.height
    }
    const children = nodeRect.node.type === 'group'
      ? buildGroupChildren(readCanvasNodes(), nodeRect.node.id, origin)
      : undefined

    activeRef.current = {
      kind: 'drag',
      lockToken,
      pointerId: event.pointerId,
      nodeId: nodeRect.node.id,
      nodeType: nodeRect.node.type,
      start: {
        x: event.clientX,
        y: event.clientY
      },
      origin,
      last: origin,
      size,
      children
    }
    setActivePointerId(event.pointerId)
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

  const handleTransformPointerDown = useCallback((
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return
    if (activeRef.current) return
    if (instance.state.tool() !== 'select') return

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
          snapEnabled: instance.state.tool() === 'select',
          allowCross: event.altKey,
          nodes: readCanvasNodes(),
          config: instance.config,
          readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
        })

        active.last = preview.position
        active.hoveredGroupId = preview.hoveredGroupId

        node.write({
          patches: preview.patches,
          hoveredGroupId: preview.hoveredGroupId
        })
        guides.write(preview.guides)
        return
      }

      if (event.pointerId !== active.drag.pointerId) return

      if (active.drag.mode === 'resize') {
        const preview = resolveResizePreview({
          activeTool: instance.state.tool(),
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
    handleNodePointerDown,
    handleTransformPointerDown
  }
}
