import { getRectCenter } from '@whiteboard/core/geometry'
import { createValueStore } from '@whiteboard/core/runtime'
import type { TransformHandle } from '@whiteboard/core/node'
import type { NodeId, NodePatch } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InternalWhiteboardInstance } from '../../../../runtime/instance/types'
import {
  resolveGroupResizePadding,
  resolveResizeCommitPatch,
  resolveResizeDrag,
  resolveResizePreview,
  resolveRotatePreview,
  type ResizeDragState,
  type RotateDragState
} from '../transform/math'

type ActiveTransform = {
  nodeId: NodeId
  drag: ResizeDragState | RotateDragState
}

export const createNodeTransformSession = (
  instance: InternalWhiteboardInstance
) => {
  let active: ActiveTransform | null = null
  let interactionToken: ReturnType<typeof instance.interaction.tryStart> | null = null
  const pointer = createValueStore<number | null>(null)

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clear = (pointerId?: number) => {
    if (
      pointerId !== undefined
      && active
      && active.drag.pointerId !== pointerId
    ) {
      return
    }

    const previousInteractionToken = interactionToken
    active = null
    interactionToken = null
    pointer.set(null)
    instance.draft.node.clear()
    instance.draft.guides.clear()

    if (previousInteractionToken) {
      instance.interaction.finish(previousInteractionToken)
    }
  }

  const commit = (next: ActiveTransform) => {
    const node = instance.read.index.node.get(next.nodeId)?.node
    if (!node) {
      return
    }

    if (next.drag.mode === 'resize') {
      const update = next.drag.lastUpdate
      if (!update) {
        return
      }

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

      if (!patch) {
        return
      }

      void instance.commands.node.update(next.nodeId, patch)
      return
    }

    if (typeof next.drag.currentRotation !== 'number') {
      return
    }

    const previousRotation = node.rotation ?? 0
    if (previousRotation === next.drag.currentRotation) {
      return
    }

    void instance.commands.node.update(next.nodeId, {
      rotation: next.drag.currentRotation
    })
  }

  return {
    pointer,
    cancel: clear,
    handleTransformPointerDown: (
      nodeId: NodeId,
      handle: TransformHandle,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (active) return
      if (instance.state.tool.get() !== 'select') return

      const nodeRect = instance.read.index.node.get(nodeId)
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
        const { world } = instance.viewport.pointer(event)
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

      const nextInteractionToken = instance.interaction.tryStart({
        mode: 'node-transform',
        cancel: () => clear(event.pointerId),
        pointerId: event.pointerId
      })
      if (!nextInteractionToken) return

      active = {
        nodeId,
        drag
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
      if (!active || event.pointerId !== active.drag.pointerId) {
        return
      }

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
        currentPoint: instance.viewport.pointer(event).world,
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
    onWindowPointerUp: (event: PointerEvent) => {
      if (!active || event.pointerId !== active.drag.pointerId) {
        return
      }

      commit(active)
      clear(active.drag.pointerId)
    },
    onWindowPointerCancel: (event: PointerEvent) => {
      if (!active || event.pointerId !== active.drag.pointerId) {
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
