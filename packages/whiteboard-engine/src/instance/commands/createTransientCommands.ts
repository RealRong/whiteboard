import type { NodeId, Point } from '@whiteboard/core'
import type { WhiteboardCommands } from '@engine-types/commands'
import type { Size } from '@engine-types/common'
import type { WhiteboardInstance } from '@engine-types/instance'
import type { EdgeConnectState, NodeOverride, NodeViewUpdate } from '@engine-types/state'
import { isPointEqual, isSizeEqual } from '../geometry/valueEquality'
import { clearNodeOverrides, updateNodeOverrides } from '../state/nodeOverrideState'

export const createTransientCommands = (
  instance: WhiteboardInstance
): WhiteboardCommands['transient'] => {
  const { core, docRef } = instance.runtime
  const { read, write } = instance.state

  const clearTransientNodeOverridesState = (ids?: NodeId[]) => {
    write('nodeOverrides', (prev) => clearNodeOverrides(prev, ids))
  }

  const commitTransientNodeOverrides = (updates?: NodeViewUpdate[]) => {
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
      clearTransientNodeOverridesState(updates.map((item) => item.id))
    } else {
      clearTransientNodeOverridesState()
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
      clear: clearTransientNodeOverridesState,
      commit: commitTransientNodeOverrides
    },
    reset: () => {
      write('edgeConnect', { isConnecting: false } as EdgeConnectState)
      write('dragGuides', [])
      write('groupHovered', undefined)
      write('nodeOverrides', new Map<NodeId, NodeOverride>())
    }
  }
}
