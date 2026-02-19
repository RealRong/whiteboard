import type { NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Size } from '@engine-types/common'
import type { NodeViewUpdate } from '@engine-types/graph'
import type { EdgeConnectState } from '@engine-types/state'
import type { CommandContext } from '../../context'
import { isPointEqual, isSizeEqual } from '../../kernel/geometry'

export const createTransient = ({
  instance,
  graph,
  syncGraph
}: CommandContext): Commands['transient'] => {
  const { core, docRef } = instance.runtime
  const { write, batch } = instance.state

  const clearNodeOverrides = (ids?: NodeId[]) => {
    const change = graph.clearNodeOverrides(ids)
    if (!change) return
    syncGraph(change)
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
        const change = graph.patchNodeOverrides(updates)
        if (!change) return
        syncGraph(change)
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
