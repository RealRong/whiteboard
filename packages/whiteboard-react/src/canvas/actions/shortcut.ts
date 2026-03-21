import type {
  ShortcutAction,
  ShortcutBinding,
  ShortcutOverrides
} from '../../types/common/shortcut'
import { leave } from '../../runtime/container'
import type { WhiteboardInstance } from '../../runtime/instance'
import {
  deleteNodes,
  duplicateNodes,
  groupSelection,
  ungroupSelection
} from '../../features/node/commands'

type ReadInstance = Pick<WhiteboardInstance, 'commands' | 'state' | 'read'>

const getSelectedNodeIds = (instance: ReadInstance) =>
  [...instance.read.selection.get().target.nodeIds]

export const selectAllInScope = (instance: ReadInstance) => {
  const container = instance.state.container.get()
  if (container.id) {
    instance.commands.selection.replace([...container.ids])
    return
  }

  instance.commands.selection.replace([...instance.read.node.list.get()])
}

const deleteCurrent = (
  instance: ReadInstance
) => {
  const selection = instance.read.selection.get()
  if (selection.target.edgeId !== undefined) {
    const result = instance.commands.edge.delete([selection.target.edgeId])
    if (!result.ok) return
    return
  }

  deleteNodes(instance, selection.target.nodeIds)
}

const duplicateCurrent = (
  instance: ReadInstance
) => {
  const nodeIds = getSelectedNodeIds(instance)
  if (!nodeIds.length) return
  duplicateNodes(instance, nodeIds)
}

export const DEFAULT_SHORTCUT_BINDINGS: readonly ShortcutBinding[] = [
  { key: 'Mod+G', action: 'group.create' },
  { key: 'Shift+Mod+G', action: 'group.ungroup' },
  { key: 'Mod+A', action: 'selection.selectAll' },
  { key: 'Escape', action: 'selection.clear' },
  { key: 'Backspace', action: 'selection.delete' },
  { key: 'Delete', action: 'selection.delete' },
  { key: 'Mod+D', action: 'selection.duplicate' },
  { key: 'Mod+Z', action: 'history.undo' },
  { key: 'Shift+Mod+Z', action: 'history.redo' },
  { key: 'Mod+Y', action: 'history.redo' }
] as const

export const resolveShortcutBindings = (
  defaults: readonly ShortcutBinding[] = DEFAULT_SHORTCUT_BINDINGS,
  overrides?: ShortcutOverrides
): readonly ShortcutBinding[] => {
  if (!overrides) return defaults
  return typeof overrides === 'function' ? overrides(defaults) : overrides
}

const canDispatchShortcutAction = (
  instance: ReadInstance,
  action: ShortcutAction
) => {
  const selection = instance.read.selection.get()
  const can = selection.can
  const hasSelection = can.delete || selection.target.edgeId !== undefined

  switch (action) {
    case 'group.create':
      return can.makeGroup
    case 'group.ungroup':
      return can.ungroup
    case 'selection.selectAll':
      return true
    case 'selection.clear':
      return (
        hasSelection
        || instance.state.container.get().id !== undefined
        || !instance.read.tool.is('select')
      )
    case 'selection.delete':
      return hasSelection
    case 'selection.duplicate':
      return can.duplicate
    case 'history.undo':
    case 'history.redo':
      return true
    default:
      return false
  }
}

export const dispatchCanvasShortcutAction = (
  instance: ReadInstance,
  action: ShortcutAction
) => {
  if (!canDispatchShortcutAction(instance, action)) return false

  switch (action) {
    case 'selection.selectAll':
      selectAllInScope(instance)
      return true
    case 'selection.clear':
      if (!instance.read.tool.is('select')) {
        instance.commands.tool.select()
      }
      leave(instance)
      return true
    case 'selection.delete':
      deleteCurrent(instance)
      return true
    case 'selection.duplicate':
      duplicateCurrent(instance)
      return true
    case 'group.create':
      groupSelection(instance)
      return true
    case 'group.ungroup':
      ungroupSelection(instance)
      return true
    case 'history.undo':
      return instance.commands.history.undo().ok
    case 'history.redo':
      return instance.commands.history.redo().ok
    default:
      return false
  }
}
