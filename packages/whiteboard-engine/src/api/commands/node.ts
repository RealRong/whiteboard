import type { DispatchResult, NodeId, NodeInput, NodePatch } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import { applyCommandChange } from './apply'

export const createNode = (
  instance: InternalInstance
): Pick<Commands, 'node'> => {
  const { core } = instance.runtime

  const applyNodeChange = (
    change:
      | { type: 'node.create'; payload: NodeInput }
      | { type: 'node.update'; id: NodeId; patch: NodePatch }
      | { type: 'node.delete'; ids: NodeId[] }
      | { type: 'node.move'; ids: NodeId[]; delta: { x: number; y: number } }
      | { type: 'node.resize'; id: NodeId; size: { width: number; height: number } }
      | { type: 'node.rotate'; id: NodeId; angle: number }
  ): Promise<DispatchResult> => applyCommandChange(instance, change)

  return {
    node: {
      create: (payload: NodeInput) => applyNodeChange({ type: 'node.create', payload }),
      update: (id: NodeId, patch: NodePatch) => applyNodeChange({ type: 'node.update', id, patch }),
      updateData: (id: NodeId, patch: Record<string, unknown>) => {
        const node = instance.graph.read().canvasNodes.find((item) => item.id === id)
        if (!node) return undefined
        return applyNodeChange({
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
      delete: (ids: NodeId[]) => applyNodeChange({ type: 'node.delete', ids }),
      move: (ids, delta) => applyNodeChange({ type: 'node.move', ids, delta }),
      resize: (id, size) => applyNodeChange({ type: 'node.resize', id, size }),
      rotate: (id, angle) => applyNodeChange({ type: 'node.rotate', id, angle })
    }
  }
}
