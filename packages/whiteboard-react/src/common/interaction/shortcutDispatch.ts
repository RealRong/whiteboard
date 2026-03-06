import type {
  DispatchResult,
  NodeId,
  Operation
} from '@whiteboard/core/types'
import type {
  Instance,
  ShortcutAction
} from '@whiteboard/engine'

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

const getSelectedNodeIds = (instance: Instance): NodeId[] =>
  Array.from(instance.state.read('selection').selectedNodeIds)

const groupSelection = async (instance: Instance) => {
  const selectedNodeIds = getSelectedNodeIds(instance)
  if (selectedNodeIds.length < 2) return

  const result = await instance.commands.node.group.create(selectedNodeIds)
  const groupId = readCreatedGroupId(result)
  if (!groupId) return
  instance.commands.selection.select([groupId], 'replace')
}

const ungroupSelection = async (instance: Instance) => {
  const selectedNodeIds = getSelectedNodeIds(instance)
  if (!selectedNodeIds.length) return

  const result = await instance.commands.node.group.ungroupMany(selectedNodeIds)
  if (!result.ok) return
  instance.commands.selection.clear()
}

const deleteSelection = async (instance: Instance) => {
  const selection = instance.state.read('selection')
  const selectedEdgeId = selection.selectedEdgeId
  const selectedNodeIds = Array.from(selection.selectedNodeIds)
  if (!selectedEdgeId && !selectedNodeIds.length) return

  if (selectedEdgeId) {
    const result = await instance.commands.edge.delete([selectedEdgeId])
    if (!result.ok) return
    instance.commands.edge.select(undefined)
    return
  }

  const result = await instance.commands.node.deleteCascade(selectedNodeIds)
  if (!result.ok) return
  instance.commands.selection.clear()
}

const duplicateSelection = async (instance: Instance) => {
  const selectedNodeIds = getSelectedNodeIds(instance)
  if (!selectedNodeIds.length) return

  const result = await instance.commands.node.duplicate(selectedNodeIds)
  const nextSelectedNodeIds = readCreatedNodeIds(result)
  if (!nextSelectedNodeIds.length) return
  instance.commands.selection.select(nextSelectedNodeIds, 'replace')
}

export const canDispatchShortcutAction = (
  instance: Instance,
  action: ShortcutAction
): boolean => {
  const interaction = instance.state.read('interaction')
  const focus = interaction.focus
  if (focus.isEditingText || focus.isInputFocused || focus.isImeComposing) {
    return false
  }

  const selection = instance.state.read('selection')
  const selectedNodeCount = selection.selectedNodeIds.size
  const hasNodeSelection = selectedNodeCount > 0
  const hasEdgeSelection = Boolean(selection.selectedEdgeId)

  switch (action) {
    case 'group.create':
      return selectedNodeCount >= 2
    case 'group.ungroup':
      return hasNodeSelection
    case 'selection.selectAll':
      return true
    case 'selection.clear':
      return hasNodeSelection || hasEdgeSelection
    case 'selection.delete':
      return hasNodeSelection || hasEdgeSelection
    case 'selection.duplicate':
      return hasNodeSelection
    case 'history.undo':
    case 'history.redo':
      return true
    default:
      return false
  }
}

export const dispatchShortcutAction = (
  instance: Instance,
  action: ShortcutAction
): boolean => {
  if (!canDispatchShortcutAction(instance, action)) return false

  switch (action) {
    case 'selection.selectAll':
      instance.commands.selection.selectAll()
      return true
    case 'selection.clear':
      instance.commands.selection.clear()
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
