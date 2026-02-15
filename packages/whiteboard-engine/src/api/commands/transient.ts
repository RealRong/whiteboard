import type { NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Size } from '@engine-types/common'
import type { Instance } from '@engine-types/instance'
import type { EdgeConnectState, NodeOverride, NodeViewUpdate } from '@engine-types/state'
import { isPointEqual, isSizeEqual } from '../../infra/geometry/valueEquality'
import { clearNodeOverrides as clearNodeOverridesState, updateNodeOverrides } from '../../state/internal/nodeOverrideState'

export const createTransient = (
  instance: Instance
): Commands['transient'] => {
  const { core, docRef } = instance.runtime
  const { read, write } = instance.state

  const clearNodeOverrides = (ids?: NodeId[]) => {
    write('nodeOverrides', (prev) => clearNodeOverridesState(prev, ids))
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
        write('nodeOverrides', (prev) => updateNodeOverrides(prev, updates))
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
