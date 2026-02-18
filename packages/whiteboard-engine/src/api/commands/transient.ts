import type { NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Size } from '@engine-types/common'
import type { GraphProjector, NodeViewUpdate } from '@engine-types/graph'
import type { Instance } from '@engine-types/instance/instance'
import type { EdgeConnectState } from '@engine-types/state'
import { isPointEqual, isSizeEqual } from '../../kernel/geometry'

export const createTransient = (
  instance: Instance,
  graph: GraphProjector
): Commands['transient'] => {
  const { core, docRef } = instance.runtime
  const { write, batch } = instance.state

  const clearNodeOverrides = (ids?: NodeId[]) => {
    graph.clearNodeOverrides(ids)
  }

  const commitNodeOverrides = (updates?: NodeViewUpdate[]) => {
    const list: NodeViewUpdate[] = updates ?? graph.readNodeOverrides()
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

    if (!ops.length) {
      if (updates) {
        clearNodeOverrides(updates.map((item) => item.id))
      } else {
        clearNodeOverrides()
      }
      return
    }

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
        graph.patchNodeOverrides(updates)
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
