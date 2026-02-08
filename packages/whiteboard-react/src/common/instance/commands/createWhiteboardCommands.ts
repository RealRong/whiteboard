import type {
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch
} from '@whiteboard/core'
import type { WhiteboardCommands } from 'types/commands'
import type { WhiteboardInstance } from 'types/instance'
import { edgeSelectionAtom, interactionAtom, spacePressedAtom, toolAtom } from '../../state'
import { groupHoveredAtom } from '../../../node/state'
import { createEdgeConnectCommands } from './createEdgeConnectCommands'
import { createSelectionCommands } from './createSelectionCommands'
import { createTransientCommands } from './createTransientCommands'
import { mergeInteractionPatch } from '../state/interactionState'
import { setStoreAtom } from '../store/setStoreAtom'

export const createWhiteboardCommands = (instance: WhiteboardInstance): WhiteboardCommands => {
  const { core } = instance.runtime
  const { store } = instance.state

  const selection = createSelectionCommands(instance)
  const { edgeConnect, cancelHoverFrame } = createEdgeConnectCommands(instance)
  const transient = createTransientCommands(instance, {
    cancelEdgeHoverFrame: cancelHoverFrame
  })

  return {
    tool: {
      set: (tool) => {
        setStoreAtom(store, toolAtom, tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        setStoreAtom(store, spacePressedAtom, pressed)
      }
    },
    interaction: {
      update: (patch) => {
        setStoreAtom(store, interactionAtom, (prev) => mergeInteractionPatch(prev, patch))
      },
      clearHover: () => {
        setStoreAtom(store, interactionAtom, (prev) =>
          mergeInteractionPatch(prev, { hover: { nodeId: undefined, edgeId: undefined } })
        )
      }
    },
    selection,
    edge: {
      create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
      update: (id: EdgeId, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
      delete: (ids: EdgeId[]) => core.dispatch({ type: 'edge.delete', ids }),
      connect: core.commands.edge.connect as WhiteboardCommands['edge']['connect'],
      reconnect: core.commands.edge.reconnect as WhiteboardCommands['edge']['reconnect'],
      select: (id) => {
        setStoreAtom(store, edgeSelectionAtom, (prev) => (prev === id ? prev : id))
      }
    },
    edgeConnect,
    groupRuntime: {
      setHoveredGroupId: (groupId) => {
        setStoreAtom(store, groupHoveredAtom, groupId)
      }
    },
    transient,
    order: core.commands.order,
    viewport: core.commands.viewport,
    node: {
      create: (payload: NodeInput) => core.dispatch({ type: 'node.create', payload }),
      update: (id: NodeId, patch: NodePatch) => core.dispatch({ type: 'node.update', id, patch }),
      delete: (ids: NodeId[]) => core.dispatch({ type: 'node.delete', ids }),
      move: core.commands.node.move as WhiteboardCommands['node']['move'],
      resize: core.commands.node.resize as WhiteboardCommands['node']['resize'],
      rotate: core.commands.node.rotate as WhiteboardCommands['node']['rotate']
    },
    group: core.commands.group as WhiteboardCommands['group'],
    mindmap: core.commands.mindmap as WhiteboardCommands['mindmap']
  }
}
