import type { EdgeId } from '@whiteboard/core/types'
import type { BoardInstance } from '../../runtime/instance'
import {
  deleteNodes,
  duplicateNodes
} from '../../features/node/commands'

type StateInstance = Pick<BoardInstance, 'commands' | 'state' | 'read'>

const getSelectedNodeIds = (instance: StateInstance) =>
  [...instance.state.selection.get().target.nodeIds]

export const selectAllInScope = (instance: StateInstance) => {
  const container = instance.state.container.get()
  if (container.id) {
    instance.commands.selection.nodes([...container.ids], 'replace')
    return
  }
  instance.commands.selection.nodes([...instance.read.node.list.get()], 'replace')
}

export const clearSelectionAndExitContainer = (instance: StateInstance) => {
  instance.commands.selection.clear()
  if (instance.state.container.get().id) {
    instance.commands.container.exit()
  }
}

export const deleteCurrentSelection = async (
  instance: StateInstance
) => {
  const selection = instance.state.selection.get()
  const selectedEdgeId = selection.target.edgeId
  const selectedNodeIds = [...selection.target.nodeIds]

  if (selectedEdgeId !== undefined) {
    const result = await instance.commands.edge.delete([selectedEdgeId])
    if (!result.ok) return
    return
  }

  await deleteNodes(instance, selectedNodeIds)
}

export const deleteEdgeById = async (
  instance: Pick<BoardInstance, 'commands'>,
  edgeId: EdgeId
) => {
  const result = await instance.commands.edge.delete([edgeId])
  if (!result.ok) return
}

export const duplicateCurrentSelection = async (
  instance: StateInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (!nodeIds.length) return
  await duplicateNodes(instance, nodeIds)
}
