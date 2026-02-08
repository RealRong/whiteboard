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

export const createWhiteboardCommands = (instance: WhiteboardInstance): WhiteboardCommands => {
  const { core, api } = instance

  return {
    selection: {
      select: api.selection.select,
      toggle: api.selection.toggle,
      clear: api.selection.clear,
      getSelectedNodeIds: api.selection.getSelectedNodeIds,
      beginBox: api.selection.beginBox,
      updateBox: api.selection.updateBox,
      endBox: api.selection.endBox
    },
    order: core.commands.order,
    tool: {
      setTool: api.tool.set
    },
    interaction: {
      clearHover: api.interaction.clearHover
    },
    viewport: core.commands.viewport,
    node: {
      create: (payload: NodeInput) => core.dispatch({ type: 'node.create', payload }),
      update: (id: NodeId, patch: NodePatch) => core.dispatch({ type: 'node.update', id, patch }),
      delete: (ids: NodeId[]) => core.dispatch({ type: 'node.delete', ids }),
      move: core.commands.node.move as WhiteboardCommands['node']['move'],
      resize: core.commands.node.resize as WhiteboardCommands['node']['resize'],
      rotate: core.commands.node.rotate as WhiteboardCommands['node']['rotate']
    },
    edge: {
      create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
      update: (id: EdgeId, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
      delete: (ids: EdgeId[]) => core.dispatch({ type: 'edge.delete', ids }),
      connect: core.commands.edge.connect as WhiteboardCommands['edge']['connect'],
      reconnect: core.commands.edge.reconnect as WhiteboardCommands['edge']['reconnect'],
      select: api.edge.select
    },
    edgeConnect: {
      startFromHandle: api.edgeConnect.startFromHandle,
      startFromPoint: api.edgeConnect.startFromPoint,
      startReconnect: api.edgeConnect.startReconnect,
      updateTo: api.edgeConnect.updateTo,
      commitTo: api.edgeConnect.commitTo,
      cancel: api.edgeConnect.cancel
    },
    group: core.commands.group as WhiteboardCommands['group'],
    mindmap: core.commands.mindmap as WhiteboardCommands['mindmap']
  }
}
