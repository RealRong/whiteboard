import type { NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Size } from '@engine-types/common'
import type { Instance } from '@engine-types/instance'
import type { EdgeConnectState, NodeOverride, NodeViewUpdate } from '@engine-types/state'
import { isPointEqual, isSizeEqual } from '../../infra/geometry/equality'

const applyNodeOverrides = (
  prev: Map<NodeId, NodeOverride>,
  updates: NodeViewUpdate[]
): Map<NodeId, NodeOverride> => {
  if (!updates.length) return prev
  const next = new Map(prev)
  let changed = false
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
    changed = true
    next.set(update.id, merged)
  })
  return changed ? next : prev
}

const clearNodeOverridesMap = (
  prev: Map<NodeId, NodeOverride>,
  ids?: NodeId[]
): Map<NodeId, NodeOverride> => {
  if (!ids || ids.length === 0) return new Map<NodeId, NodeOverride>()
  const next = new Map(prev)
  let changed = false
  ids.forEach((id) => {
    if (!next.has(id)) return
    next.delete(id)
    changed = true
  })
  return changed ? next : prev
}

export const createTransient = (
  instance: Instance
): Commands['transient'] => {
  const { core, docRef } = instance.runtime
  const { read, write } = instance.state

  const clearNodeOverrides = (ids?: NodeId[]) => {
    write('nodeOverrides', (prev) => clearNodeOverridesMap(prev, ids))
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
        write('nodeOverrides', (prev) => applyNodeOverrides(prev, updates))
      },
      clear: clearNodeOverrides,
      commit: commitNodeOverrides
    },
    reset: () => {
      write('edgeConnect', { isConnecting: false } as EdgeConnectState)
      write('routingDrag', {})
      write('dragGuides', [])
      write('groupHovered', undefined)
      write('nodeOverrides', new Map<NodeId, NodeOverride>())
      write('mindmapDrag', {})
      write('nodeDrag', {})
      write('nodeTransform', {})
    }
  }
}
