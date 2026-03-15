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
  [...instance.read.selection.nodeIds()]

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
  const selectedEdgeId = instance.read.selection.edgeId()
  const selectedNodeIds = [...instance.read.selection.nodeIds()]
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
  if (!instance.read.scope.activeId()) {
    instance.commands.selection.selectAll()
    return
  }
  instance.commands.selection.select(
    [...instance.read.scope.nodeIds()],
    'replace'
  )
}

export const canDispatchShortcutAction = (
  instance: InternalWhiteboardInstance,
  action: ShortcutAction
): boolean => {
  const selection = instance.view.selection.get()

  switch (action) {
    case 'group.create':
      return selection.canGroup
    case 'group.ungroup':
      return selection.canUngroup
    case 'selection.selectAll':
      return selection.canSelectAll
    case 'selection.clear':
      return selection.canClear
    case 'selection.delete':
      return selection.canDelete
    case 'selection.duplicate':
      return selection.canDuplicate
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
      if (instance.read.scope.activeId()) {
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
