import {
  getRectCenter,
  isPointEqual,
  isSizeEqual
} from '@whiteboard/core/geometry'
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
  resolveSelectionResizePreview,
  resolveSelectionRotatePreview,
  type ResizeDragState,
  type RotateDragState,
  type SelectionTransformMember,
  type TransformPreviewPatch
} from '../transform/math'
import {
  isTextNode,
  setTextWidthMode
} from '../../text'

type ActiveTransform =
  | {
      kind: 'node'
      nodeId: NodeId
      drag: ResizeDragState | RotateDragState
    }
  | {
      kind: 'selection'
      members: readonly SelectionTransformMember[]
      drag: ResizeDragState | RotateDragState
      lastPatches?: readonly TransformPreviewPatch[]
    }

const toSelectionMember = (
  instance: InternalInstance,
  nodeId: NodeId
): SelectionTransformMember | undefined => {
  const item = instance.read.node.item.get(nodeId)
  if (!item) {
    return undefined
  }

  return {
    node: item.node,
    rect: item.rect,
    rotation: typeof item.node.rotation === 'number' ? item.node.rotation : 0
  }
}

const resolveSelectionCommitPatch = (
  node: SelectionTransformMember['node'],
  preview: TransformPreviewPatch
) => {
  const patch: NodePatch = {}

  if (preview.position && !isPointEqual(preview.position, node.position)) {
    patch.position = preview.position
  }
  if (preview.size && !isSizeEqual(preview.size, node.size)) {
    patch.size = preview.size
  }
  if (
    typeof preview.rotation === 'number'
    && preview.rotation !== (node.rotation ?? 0)
  ) {
    patch.rotation = preview.rotation
  }

  if (!patch.position && !patch.size && patch.rotation === undefined) {
    return undefined
  }

  return patch
}

export const createTransformSession = (
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

  const commitNode = (
    next: Extract<ActiveTransform, { kind: 'node' }>
  ) => {
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
      if (patch?.size && isTextNode(node)) {
        patch = {
          ...patch,
          data: setTextWidthMode(node, 'fixed')
        }
      }
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

  const commitSelection = (
    next: Extract<ActiveTransform, { kind: 'selection' }>
  ) => {
    if (!next.lastPatches?.length) {
      return
    }

    const nodes = readCanvasNodes()
    const updates = next.lastPatches.flatMap((preview) => {
      const member = next.members.find((item) => item.node.id === preview.id)
      if (!member) {
        return []
      }

      let patch = resolveSelectionCommitPatch(member.node, preview)
      if (!patch) {
        return []
      }

      if (patch.size && isTextNode(member.node)) {
        patch = {
          ...patch,
          data: setTextWidthMode(member.node, 'fixed')
        }
      }

      if (patch.size && patch.position) {
        const padding = resolveGroupResizePadding({
          group: member.node,
          update: {
            position: patch.position,
            size: patch.size
          },
          nodes,
          nodeSize: instance.config.nodeSize
        })

        if (padding !== undefined) {
          patch = {
            ...patch,
            data: {
              ...(member.node.data ?? {}),
              autoFit: 'manual',
              padding
            }
          }
        } else if (member.node.type === 'group') {
          patch = {
            ...patch,
            data: {
              ...(member.node.data ?? {}),
              autoFit: 'manual'
            }
          }
        }
      }

      return [{
        id: member.node.id,
        patch
      }]
    })

    if (!updates.length) {
      return
    }

    instance.commands.node.updateMany(updates)
  }

  const commit = (next: ActiveTransform) => {
    if (next.kind === 'node') {
      commitNode(next)
      return
    }

    commitSelection(next)
  }

  const writePreview = (
    patches: readonly TransformPreviewPatch[],
    guides: ReturnType<typeof resolveResizePreview>['guides'] = []
  ) => {
    instance.internals.node.session.write({
      patches
    })
    instance.internals.node.guides.write(guides)
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
          if (!active || active.kind !== 'node') {
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
              excludeNodeIds: [active.nodeId],
              config: instance.config,
              readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
            })

            active.drag.lastUpdate = preview.update
            writePreview([{
              id: active.nodeId,
              position: preview.update.position,
              size: preview.update.size
            }], preview.guides)
            return
          }

          const rotation = resolveRotatePreview({
            drag: active.drag,
            currentPoint: instance.viewport.pointer(event).world,
            shiftKey: event.shiftKey
          })
          active.drag.currentRotation = rotation
          writePreview([{
            id: active.nodeId,
            rotation
          }])
        },
        up: (_event, session) => {
          if (!active || active.kind !== 'node') {
            return
          }

          commit(active)
          session.finish()
        }
      })
      if (!nextSession) return

      active = {
        kind: 'node',
        nodeId,
        drag
      }
      session = nextSession
      instance.internals.node.session.clear()
      instance.internals.node.guides.clear()

      event.preventDefault()
      event.stopPropagation()
    },
    handleSelectionPointerDown: (
      handle: TransformHandle,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (active) return
      if (!instance.read.tool.is('select')) return

      const selection = instance.read.selection.get()
      if (selection.items.count <= 1 || !selection.box) {
        return
      }

      const members = selection.target.nodeIds
        .map((nodeId) => toSelectionMember(instance, nodeId))
        .filter((member): member is SelectionTransformMember => Boolean(member))
      if (members.length !== selection.target.nodeIds.length) {
        return
      }

      let drag: ResizeDragState | RotateDragState
      if (handle.kind === 'resize') {
        if (!handle.direction || selection.transform.resize === 'none') {
          return
        }
        drag = resolveResizeDrag({
          pointerId: event.pointerId,
          handle: handle.direction,
          rect: selection.box,
          rotation: 0,
          startScreen: {
            x: event.clientX,
            y: event.clientY
          }
        })
      } else {
        if (!selection.transform.rotate) {
          return
        }
        const center = getRectCenter(selection.box)
        const { world } = instance.viewport.pointer(event)
        drag = {
          mode: 'rotate',
          pointerId: event.pointerId,
          startAngle: Math.atan2(world.y - center.y, world.x - center.x),
          startRotation: 0,
          currentRotation: 0,
          center
        }
      }

      const nextSession = instance.interaction.start({
        mode: 'node-transform',
        pointerId: event.pointerId,
        capture: event.currentTarget,
        cleanup: clear,
        move: (event) => {
          if (!active || active.kind !== 'selection') {
            return
          }

          if (active.drag.mode === 'resize') {
            const preview = resolveSelectionResizePreview({
              snapEnabled: instance.read.tool.is('select'),
              drag: active.drag,
              currentScreen: {
                x: event.clientX,
                y: event.clientY
              },
              zoom: instance.viewport.get().zoom,
              altKey: event.altKey,
              shiftKey: event.shiftKey,
              members: active.members,
              config: instance.config,
              readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
            })

            active.lastPatches = preview.patches
            writePreview(preview.patches, preview.guides)
            return
          }

          const preview = resolveSelectionRotatePreview({
            drag: active.drag,
            currentPoint: instance.viewport.pointer(event).world,
            shiftKey: event.shiftKey,
            members: active.members
          })
          active.drag.currentRotation = resolveRotatePreview({
            drag: active.drag,
            currentPoint: instance.viewport.pointer(event).world,
            shiftKey: event.shiftKey
          })
          active.lastPatches = preview.patches
          writePreview(preview.patches)
        },
        up: (_event, session) => {
          if (!active || active.kind !== 'selection') {
            return
          }

          commit(active)
          session.finish()
        }
      })
      if (!nextSession) return

      active = {
        kind: 'selection',
        members,
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
