import { getRectCenter } from '@whiteboard/core/geometry'
import type { TransformHandle } from '@whiteboard/core/node'
import type { NodeId, NodePatch } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { InternalInstance } from '../../../../runtime/instance'
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
  instance: InternalInstance
) => {
  let active: ActiveTransform | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clear = () => {
    active = null
    session = null
    instance.internals.node.session.clear()
    instance.internals.node.guides.clear()
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

      instance.commands.node.update(next.nodeId, patch)
      return
    }

    if (typeof next.drag.currentRotation !== 'number') {
      return
    }

    const previousRotation = node.rotation ?? 0
    if (previousRotation === next.drag.currentRotation) {
      return
    }

    instance.commands.node.update(next.nodeId, {
      rotation: next.drag.currentRotation
    })
  }

  return {
    cancel: () => {
      if (session) {
        session.cancel()
        return
      }
      clear()
    },
    handleTransformPointerDown: (
      nodeId: NodeId,
      handle: TransformHandle,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (active) return
      if (!instance.read.tool.is('select')) return

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

      const nextSession = instance.interaction.start({
        mode: 'node-transform',
        pointerId: event.pointerId,
        capture: event.currentTarget,
        cleanup: clear,
        move: (event) => {
          if (!active) {
            return
          }

          if (active.drag.mode === 'resize') {
            const preview = resolveResizePreview({
              snapEnabled: instance.read.tool.is('select'),
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
            instance.internals.node.session.write({
              patches: [{
                id: active.nodeId,
                position: preview.update.position,
                size: preview.update.size
              }]
            })
            instance.internals.node.guides.write(preview.guides)
            return
          }

          const rotation = resolveRotatePreview({
            drag: active.drag,
            currentPoint: instance.viewport.pointer(event).world,
            shiftKey: event.shiftKey
          })
          active.drag.currentRotation = rotation
          instance.internals.node.session.write({
            patches: [{
              id: active.nodeId,
              rotation
            }]
          })
          instance.internals.node.guides.write([])
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

      active = {
        nodeId,
        drag
      }
      session = nextSession
      instance.internals.node.session.clear()
      instance.internals.node.guides.clear()

      event.preventDefault()
      event.stopPropagation()
    }
  }
}
