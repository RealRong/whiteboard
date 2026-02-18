import type { NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Size } from '@engine-types/common'
import type { Instance } from '@engine-types/instance/instance'
import type { EdgeConnectState, NodeOverride, NodeViewUpdate } from '@engine-types/state'
import { isPointEqual, isSizeEqual } from '../../kernel/geometry'
import type { CanvasNodes } from '../../kernel/projector/canvas'

const applyNodeOverrides = (
  prev: Map<NodeId, NodeOverride>,
  updates: NodeViewUpdate[]
): { next: Map<NodeId, NodeOverride>; changedNodeIds: NodeId[] } => {
  if (!updates.length) {
    return {
      next: prev,
      changedNodeIds: []
    }
  }
  const next = new Map(prev)
  const changedNodeIds: NodeId[] = []
  updates.forEach((update) => {
    if (!update.position && !update.size) return

    const current = next.get(update.id) ?? {}
    const merged = {
      position: update.position ?? current.position,
      size: update.size ?? current.size
    }
    if (isPointEqual(merged.position, current.position) && isSizeEqual(merged.size, current.size)) {
      return
    }
    changedNodeIds.push(update.id)
    next.set(update.id, merged)
  })
  return {
    next: changedNodeIds.length ? next : prev,
    changedNodeIds
  }
}

const clearNodeOverridesMap = (
  prev: Map<NodeId, NodeOverride>,
  ids?: NodeId[]
): { next: Map<NodeId, NodeOverride>; changedNodeIds: NodeId[] } => {
  if (!ids || ids.length === 0) {
    return {
      next: new Map<NodeId, NodeOverride>(),
      changedNodeIds: Array.from(prev.keys())
    }
  }
  const next = new Map(prev)
  const changedNodeIds: NodeId[] = []
  ids.forEach((id) => {
    if (!next.has(id)) return
    next.delete(id)
    changedNodeIds.push(id)
  })
  return {
    next: changedNodeIds.length ? next : prev,
    changedNodeIds
  }
}

export const createTransient = (
  instance: Instance,
  canvas: CanvasNodes
): Commands['transient'] => {
  const { core, docRef } = instance.runtime
  const { read, write, batch } = instance.state

  const clearNodeOverrides = (ids?: NodeId[]) => {
    let changedNodeIds: NodeId[] = []
    batch(() => {
      write('nodeOverrides', (prev) => {
        const result = clearNodeOverridesMap(prev, ids)
        changedNodeIds = result.changedNodeIds
        return result.next
      })
      if (changedNodeIds.length) {
        canvas.reportDirty(changedNodeIds)
      }
    })
  }

  const commitNodeOverrides = (updates?: NodeViewUpdate[]) => {
    const list: NodeViewUpdate[] =
      updates ??
      Array.from(read('nodeOverrides').entries()).map(([id, override]) => ({ id, ...override }))
    if (!list.length) return

    const ops = list
      .map((item) => {
        const patch: { position?: Point; size?: Size } = {}
        if (item.position) patch.position = item.position
        if (item.size) patch.size = item.size
        if (!patch.position && !patch.size) return null

        const currentNode = docRef.current?.nodes.find((node) => node.id === item.id)
        if (currentNode) {
          const samePosition = patch.position === undefined || isPointEqual(patch.position, currentNode.position)
          const sameSize = patch.size === undefined || isSizeEqual(patch.size, currentNode.size)
          if (samePosition && sameSize) return null
        }

        return { id: item.id, patch }
      })
      .filter((item): item is { id: NodeId; patch: { position?: Point; size?: Size } } => Boolean(item))

    if (!ops.length) return

    core.model.node.updateMany(ops)
    if (updates) {
      clearNodeOverrides(updates.map((item) => item.id))
    } else {
      clearNodeOverrides()
    }
  }

  return {
    dragGuides: {
      set: (guides) => {
        write('dragGuides', guides)
      },
      clear: () => {
        write('dragGuides', [])
      }
    },
    nodeOverrides: {
      set: (updates) => {
        let changedNodeIds: NodeId[] = []
        batch(() => {
          write('nodeOverrides', (prev) => {
            const result = applyNodeOverrides(prev, updates)
            changedNodeIds = result.changedNodeIds
            return result.next
          })
          if (changedNodeIds.length) {
            canvas.reportDirty(changedNodeIds)
          }
        })
      },
      clear: clearNodeOverrides,
      commit: commitNodeOverrides
    },
    reset: () => {
      batch(() => {
        write('edgeConnect', { isConnecting: false } as EdgeConnectState)
        write('routingDrag', {})
        write('dragGuides', [])
        write('groupHovered', undefined)
        clearNodeOverrides()
        write('mindmapDrag', {})
        write('nodeDrag', {})
        write('nodeTransform', {})
      })
    }
  }
}
