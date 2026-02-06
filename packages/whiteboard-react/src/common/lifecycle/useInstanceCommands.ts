import { useEffect, useMemo } from 'react'
import { useSetAtom } from 'jotai'
import type { EdgeInput, EdgePatch, NodeInput, NodePatch } from '@whiteboard/core'
import { selectionAtom } from '../state/whiteboardAtoms'
import { useSelection } from '../../node/hooks'
import { useEdgeConnect } from '../../edge/hooks'
import { useInstance } from '../hooks/useInstance'
import { useInteraction } from '../hooks/useInteraction'
import type { WhiteboardCommands } from '../instance/whiteboardInstance'

export const useInstanceCommands = () => {
  const instance = useInstance()
  const selection = useSelection()
  const edgeConnect = useEdgeConnect()
  const setSelection = useSetAtom(selectionAtom)
  const { update: updateInteraction } = useInteraction()

  const commands = useMemo<WhiteboardCommands>(() => {
    const core = instance.core
    return {
      selection: {
        select: selection.select,
        toggle: selection.toggle,
        clear: selection.clear,
        getSelectedNodeIds: () => Array.from(selection.selectedNodeIds)
      },
      tool: {
        setTool: (tool) => {
          setSelection((prev) => ({ ...prev, tool }))
        }
      },
      interaction: {
        clearHover: () => {
          updateInteraction({ hover: { nodeId: undefined, edgeId: undefined } })
        }
      },
      viewport: core.commands.viewport,
      node: {
        create: (payload: NodeInput) => core.dispatch({ type: 'node.create', payload }),
        update: (id, patch: NodePatch) => core.dispatch({ type: 'node.update', id, patch }),
        delete: (ids) => core.dispatch({ type: 'node.delete', ids }),
        move: core.commands.node.move,
        resize: core.commands.node.resize,
        rotate: core.commands.node.rotate
      },
      edge: {
        create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
        update: (id, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
        delete: (ids) => core.dispatch({ type: 'edge.delete', ids }),
        connect: core.commands.edge.connect,
        reconnect: core.commands.edge.reconnect,
        select: edgeConnect.selectEdge
      },
      edgeConnect: {
        startFromHandle: edgeConnect.startFromHandle,
        startFromPoint: edgeConnect.startFromPoint,
        startReconnect: edgeConnect.startReconnect,
        updateTo: edgeConnect.updateTo,
        commitTo: edgeConnect.commitTo,
        cancel: edgeConnect.cancel
      },
      group: core.commands.group,
      mindmap: core.commands.mindmap
    }
  }, [edgeConnect, instance, selection, setSelection, updateInteraction])

  useEffect(() => {
    instance.setCommands(commands)
  }, [commands, instance])
}
