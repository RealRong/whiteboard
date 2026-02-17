import type { NodeId, NodeInput, NodePatch } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'

export const createNode = (
  instance: Instance,
  transient: Commands['transient']
): Pick<Commands, 'nodeDrag' | 'node' | 'nodeTransform'> => {
  const { core } = instance.runtime
  const { read, write, batchFrame } = instance.state

  const nodeTransform: Commands['nodeTransform'] = {
    rotate: (nodeId, angle) => (core.commands.node.rotate as Commands['node']['rotate'])(nodeId, angle),
    previewResize: (nodeId, update) => {
      transient.nodeOverrides.set([{ id: nodeId, ...update }])
    },
    commitResize: (nodeId, update) => {
      transient.nodeOverrides.commit(update ? [{ id: nodeId, ...update }] : undefined)
    },
    setGuides: (guides) => {
      transient.dragGuides.set(guides)
    },
    clearGuides: () => {
      transient.dragGuides.clear()
    },
    startResize: ({ nodeId, pointerId, handle, clientX, clientY, rect, rotation }) => {
      if (read('nodeTransform').active) return false
      const drag = instance.runtime.services.nodeTransform.createResizeDrag({
        pointerId,
        handle,
        clientX,
        clientY,
        rect,
        rotation
      })
      write('nodeTransform', {
        active: {
          nodeId,
          drag
        }
      })
      return true
    },
    startRotate: ({ nodeId, pointerId, clientX, clientY, rect, rotation }) => {
      if (read('nodeTransform').active) return false
      const drag = instance.runtime.services.nodeTransform.createRotateDrag({
        pointerId,
        clientX,
        clientY,
        rect,
        rotation
      })
      write('nodeTransform', {
        active: {
          nodeId,
          drag
        }
      })
      return true
    },
    update: ({ pointerId, clientX, clientY, minSize, altKey, shiftKey }) => {
      const active = read('nodeTransform').active
      if (!active || active.drag.pointerId !== pointerId) return false

      batchFrame(() => {
        if (active.drag.mode === 'resize') {
          instance.runtime.services.nodeTransform.applyResizeMove({
            nodeId: active.nodeId,
            drag: active.drag,
            clientX,
            clientY,
            minSize,
            altKey: Boolean(altKey),
            shiftKey: Boolean(shiftKey)
          })
        } else {
          instance.runtime.services.nodeTransform.applyRotateMove({
            nodeId: active.nodeId,
            drag: active.drag,
            clientX,
            clientY,
            shiftKey: Boolean(shiftKey)
          })
        }

        write('nodeTransform', {
          active
        })
      })
      return true
    },
    end: ({ pointerId }) => {
      const active = read('nodeTransform').active
      if (!active || active.drag.pointerId !== pointerId) return false

      if (active.drag.mode === 'resize') {
        instance.runtime.services.nodeTransform.finishResize({
          nodeId: active.nodeId,
          drag: active.drag
        })
      } else {
        instance.runtime.services.nodeTransform.clear()
      }

      write('nodeTransform', {})
      return true
    },
    cancel: (options) => {
      const active = read('nodeTransform').active
      if (!active) return false
      if (typeof options?.pointerId === 'number' && active.drag.pointerId !== options.pointerId) return false

      if (active.drag.mode === 'resize') {
        transient.nodeOverrides.clear([active.nodeId])
      }
      instance.runtime.services.nodeTransform.clear()
      write('nodeTransform', {})
      return true
    }
  }

  const nodeDrag: Commands['nodeDrag'] = {
    start: (options) => instance.runtime.services.nodeDrag.start(options),
    update: (options) => instance.runtime.services.nodeDrag.update(options),
    end: (options) => instance.runtime.services.nodeDrag.end(options),
    cancel: (options) => instance.runtime.services.nodeDrag.cancel(options)
  }

  return {
    nodeDrag,
    node: {
      create: (payload: NodeInput) => core.dispatch({ type: 'node.create', payload }),
      update: (id: NodeId, patch: NodePatch) => core.dispatch({ type: 'node.update', id, patch }),
      updateData: (id: NodeId, patch: Record<string, unknown>) => {
        const node = read('canvasNodes').find((item) => item.id === id)
        if (!node) return undefined
        return core.dispatch({
          type: 'node.update',
          id,
          patch: {
            data: {
              ...(node.data ?? {}),
              ...patch
            }
          }
        })
      },
      updateManyPosition: (updates) => {
        if (!updates.length) return
        core.model.node.updateMany(
          updates.map((item) => ({
            id: item.id,
            patch: { position: item.position }
          }))
        )
      },
      delete: (ids: NodeId[]) => core.dispatch({ type: 'node.delete', ids }),
      move: core.commands.node.move as Commands['node']['move'],
      resize: core.commands.node.resize as Commands['node']['resize'],
      rotate: core.commands.node.rotate as Commands['node']['rotate']
    },
    nodeTransform
  }
}
