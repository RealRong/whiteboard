import { useEffect, useMemo, useRef } from 'react'
import { useSetAtom } from 'jotai'
import type { EdgeInput, EdgePatch, NodeInput, NodePatch } from '@whiteboard/core'
import { toolAtom } from '../state/whiteboardAtoms'
import { useSelectionActions, useSelectionState } from '../../node/hooks'
import { useEdgeConnectActions } from '../../edge/hooks'
import { useInstance } from '../hooks/useInstance'
import { useInteractionActions } from '../hooks/useInteraction'
import type { WhiteboardCommands } from '../instance/whiteboardInstance'

export const useInstanceCommands = () => {
  const instance = useInstance()
  const selectionState = useSelectionState()
  const selectionActions = useSelectionActions()
  const edgeConnect = useEdgeConnectActions()
  const setTool = useSetAtom(toolAtom)
  const { update: updateInteraction } = useInteractionActions()

  const selectionStateRef = useRef(selectionState)
  const selectionActionsRef = useRef(selectionActions)
  const edgeConnectRef = useRef(edgeConnect)
  const updateInteractionRef = useRef(updateInteraction)

  useEffect(() => {
    selectionStateRef.current = selectionState
  }, [selectionState])

  useEffect(() => {
    selectionActionsRef.current = selectionActions
  }, [selectionActions])

  useEffect(() => {
    edgeConnectRef.current = edgeConnect
  }, [edgeConnect])

  useEffect(() => {
    updateInteractionRef.current = updateInteraction
  }, [updateInteraction])

  const commands = useMemo<WhiteboardCommands>(() => {
    const core = instance.core

    const selectionCommands: WhiteboardCommands['selection'] = {
      select: (ids, mode) => {
        selectionActionsRef.current.select(ids, mode)
      },
      toggle: (ids) => {
        selectionActionsRef.current.toggle(ids)
      },
      clear: () => {
        selectionActionsRef.current.clear()
      },
      getSelectedNodeIds: () => Array.from(selectionStateRef.current.selectedNodeIds)
    }

    return {
      selection: selectionCommands,
      order: core.commands.order,
      tool: {
        setTool: (tool) => {
          setTool(tool)
        }
      },
      interaction: {
        clearHover: () => {
          updateInteractionRef.current({ hover: { nodeId: undefined, edgeId: undefined } })
        }
      },
      viewport: core.commands.viewport,
      node: {
        create: (payload: NodeInput) => core.dispatch({ type: 'node.create', payload }),
        update: (id, patch: NodePatch) => core.dispatch({ type: 'node.update', id, patch }),
        delete: (ids) => core.dispatch({ type: 'node.delete', ids }),
        move: core.commands.node.move as WhiteboardCommands['node']['move'],
        resize: core.commands.node.resize as WhiteboardCommands['node']['resize'],
        rotate: core.commands.node.rotate as WhiteboardCommands['node']['rotate']
      },
      edge: {
        create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
        update: (id, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
        delete: (ids) => core.dispatch({ type: 'edge.delete', ids }),
        connect: core.commands.edge.connect as WhiteboardCommands['edge']['connect'],
        reconnect: core.commands.edge.reconnect as WhiteboardCommands['edge']['reconnect'],
        select: (id) => edgeConnectRef.current.selectEdge(id)
      },
      edgeConnect: {
        startFromHandle: (...args) => edgeConnectRef.current.startFromHandle(...args),
        startFromPoint: (...args) => edgeConnectRef.current.startFromPoint(...args),
        startReconnect: (...args) => edgeConnectRef.current.startReconnect(...args),
        updateTo: (...args) => edgeConnectRef.current.updateTo(...args),
        commitTo: (...args) => edgeConnectRef.current.commitTo(...args),
        cancel: () => edgeConnectRef.current.cancel()
      },
      group: core.commands.group as WhiteboardCommands['group'],
      mindmap: core.commands.mindmap as WhiteboardCommands['mindmap']
    }
  }, [instance.core, setTool])

  useEffect(() => {
    instance.setCommands(commands)
  }, [commands, instance])
}
