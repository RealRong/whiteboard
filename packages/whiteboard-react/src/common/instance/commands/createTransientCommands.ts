import type { NodeId, Point } from '@whiteboard/core'
import type { WhiteboardCommands } from 'types/commands'
import type { Size } from 'types/common'
import type { WhiteboardInstance } from 'types/instance'
import type { EdgeConnectState, NodeOverride, NodeViewUpdate } from 'types/state'
import { edgeConnectAtom } from '../../state'
import { dragGuidesAtom, groupHoveredAtom, nodeViewOverridesAtom } from '../../../node/state'
import { isPointEqual, isSizeEqual } from '../geometry/valueEquality'
import { clearNodeOverrides, updateNodeOverrides } from '../state/nodeOverrideState'
import { setStoreAtom } from '../store/setStoreAtom'

type CreateTransientCommandsOptions = {
  cancelEdgeHoverFrame: () => void
}

export const createTransientCommands = (
  instance: WhiteboardInstance,
  { cancelEdgeHoverFrame }: CreateTransientCommandsOptions
): WhiteboardCommands['transient'] => {
  const { core, docRef } = instance.runtime
  const { store } = instance.state

  const clearTransientNodeOverridesState = (ids?: NodeId[]) => {
    setStoreAtom(store, nodeViewOverridesAtom, (prev) => clearNodeOverrides(prev, ids))
  }

  const commitTransientNodeOverrides = (updates?: NodeViewUpdate[]) => {
    const list: NodeViewUpdate[] =
      updates ??
      Array.from(store.get(nodeViewOverridesAtom).entries()).map(([id, override]) => ({ id, ...override }))
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
        setStoreAtom(store, dragGuidesAtom, guides)
      },
      clear: () => {
        setStoreAtom(store, dragGuidesAtom, [])
      }
    },
    nodeOverrides: {
      set: (updates) => {
        setStoreAtom(store, nodeViewOverridesAtom, (prev) => updateNodeOverrides(prev, updates))
      },
      clear: clearTransientNodeOverridesState,
      commit: commitTransientNodeOverrides
    },
    reset: () => {
      cancelEdgeHoverFrame()
      setStoreAtom(store, edgeConnectAtom, { isConnecting: false } as EdgeConnectState)
      setStoreAtom(store, dragGuidesAtom, [])
      setStoreAtom(store, groupHoveredAtom, undefined)
      setStoreAtom(store, nodeViewOverridesAtom, new Map<NodeId, NodeOverride>())
    }
  }
}
