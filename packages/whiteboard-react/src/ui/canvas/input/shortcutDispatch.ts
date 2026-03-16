import type {
  DispatchResult,
  NodeId,
  Operation
} from '@whiteboard/core/types'
import type { ShortcutAction } from '../../../types/common/shortcut'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'
import {
  deleteNodes,
  duplicateNodes
} from '../../../features/node/actions'

const readCreatedNodeIds = (
  result: DispatchResult,
  predicate?: (operation: Extract<Operation, { type: 'node.create' }>) => boolean
): NodeId[] => {
  if (!result.ok) return []
  return result.changes.operations
    .filter((operation): operation is Extract<Operation, { type: 'node.create' }> =>
      operation.type === 'node.create'
    )
    .filter((operation) => predicate ? predicate(operation) : true)
    .map((operation) => operation.node.id)
}

const readCreatedGroupId = (result: DispatchResult): NodeId | undefined =>
  readCreatedNodeIds(result, (operation) => operation.node.type === 'group')[0]

const getSelectedNodeIds = (instance: InternalWhiteboardInstance): NodeId[] =>
  [...instance.state.selection.get().target.nodeIds]

const groupSelection = async (instance: InternalWhiteboardInstance) => {
  const selectedNodeIds = getSelectedNodeIds(instance)
  if (selectedNodeIds.length < 2) return

  const result = await instance.commands.node.group.create(selectedNodeIds)
  const groupId = readCreatedGroupId(result)
  if (!groupId) return
  instance.commands.selection.select([groupId], 'replace')
}

const ungroupSelection = async (instance: InternalWhiteboardInstance) => {
  const selectedNodeIds = getSelectedNodeIds(instance)
  if (!selectedNodeIds.length) return

  const result = await instance.commands.node.group.ungroupMany(selectedNodeIds)
  if (!result.ok) return
  instance.commands.selection.clear()
}

const deleteSelection = async (instance: InternalWhiteboardInstance) => {
  const selection = instance.state.selection.get()
  const selectedEdgeId = selection.target.edgeId
  const selectedNodeIds = [...selection.target.nodeIds]
  if (!selectedEdgeId && !selectedNodeIds.length) return

  if (selectedEdgeId) {
    const result = await instance.commands.edge.delete([selectedEdgeId])
    if (!result.ok) return
    instance.commands.selection.selectEdge(undefined)
    return
  }

  await deleteNodes(instance, selectedNodeIds)
}

const duplicateSelection = async (instance: InternalWhiteboardInstance) => {
  const selectedNodeIds = getSelectedNodeIds(instance)
  if (!selectedNodeIds.length) return

  await duplicateNodes(instance, selectedNodeIds)
}

const selectAll = (instance: InternalWhiteboardInstance) => {
  const container = instance.state.container.get()
  if (!container.id) {
    instance.commands.selection.selectAll()
    return
  }
  instance.commands.selection.select(
    [...container.ids],
    'replace'
  )
}

export const canDispatchShortcutAction = (
  instance: InternalWhiteboardInstance,
  action: ShortcutAction
): boolean => {
  const selection = instance.state.selection.get()

  switch (action) {
    case 'group.create':
      return selection.caps.group
    case 'group.ungroup':
      return selection.caps.ungroup
    case 'selection.selectAll':
      return selection.caps.selectAll
    case 'selection.clear':
      return selection.caps.clear
    case 'selection.delete':
      return selection.caps.delete
    case 'selection.duplicate':
      return selection.caps.duplicate
    case 'history.undo':
    case 'history.redo':
      return true
    default:
      return false
  }
}

export const dispatchShortcutAction = (
  instance: InternalWhiteboardInstance,
  action: ShortcutAction
): boolean => {
  if (!canDispatchShortcutAction(instance, action)) return false

  switch (action) {
    case 'selection.selectAll':
      selectAll(instance)
      return true
    case 'selection.clear':
      instance.commands.selection.clear()
      if (instance.state.container.get().id) {
        instance.commands.container.exit()
      }
      return true
    case 'selection.delete':
      void deleteSelection(instance)
      return true
    case 'selection.duplicate':
      void duplicateSelection(instance)
      return true
    case 'group.create':
      void groupSelection(instance)
      return true
    case 'group.ungroup':
      void ungroupSelection(instance)
      return true
    case 'history.undo':
      return instance.commands.history.undo()
    case 'history.redo':
      return instance.commands.history.redo()
    default:
      return false
  }
}
