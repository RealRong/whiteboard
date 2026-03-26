import type {
  ShortcutAction,
  ShortcutBinding
} from '../types/common/shortcut'
import type { InternalInstance } from '../runtime/instance'
import { resolveNodeMeta } from '../features/node/registry'
import { resolveNodeSelectionCan } from '../features/node/summary'

export const DefaultShortcutBindings: readonly ShortcutBinding[] = [
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

type ShortcutState = ReturnType<typeof readShortcutState>

const readShortcutState = (
  instance: InternalInstance
) => {
  const selection = instance.read.selection.get()
  const can = resolveNodeSelectionCan(selection.items.nodes, {
    resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
  })

  return {
    selection,
    can,
    pureNode: selection.items.edgeCount === 0,
    hasSelection: selection.items.count > 0
  }
}

const canRunShortcut = (
  instance: InternalInstance,
  action: ShortcutAction,
  state: ShortcutState
) => {
  switch (action) {
    case 'group.create':
      return state.pureNode && state.can.makeGroup
    case 'group.ungroup':
      return state.pureNode && state.can.ungroup
    case 'selection.selectAll':
      return true
    case 'selection.clear':
      return (
        state.hasSelection
        || instance.state.frame.get().id !== undefined
        || !instance.read.tool.is('select')
      )
    case 'selection.delete':
      return state.hasSelection
    case 'selection.duplicate':
      return state.pureNode && state.can.duplicate
    case 'history.undo':
    case 'history.redo':
      return true
    default:
      return false
  }
}

export const runShortcut = (
  instance: InternalInstance,
  action: ShortcutAction
) => {
  const state = readShortcutState(instance)
  if (!canRunShortcut(instance, action, state)) {
    return false
  }

  const { selection } = state

  switch (action) {
    case 'selection.selectAll':
      instance.commands.selection.selectAll()
      return true
    case 'selection.clear':
      if (!instance.read.tool.is('select')) {
        instance.commands.tool.select()
      }
      instance.commands.frame.exit()
      return true
    case 'selection.delete':
      if (selection.target.edgeIds.length > 0) {
        const result = instance.commands.edge.delete([...selection.target.edgeIds])
        if (!result.ok) {
          return false
        }
      }

      if (selection.target.nodeIds.length > 0) {
        const result = instance.commands.node.deleteCascade([...selection.target.nodeIds])
        if (!result.ok) {
          return false
        }
      }

      return true
    case 'selection.duplicate': {
      const result = instance.commands.node.duplicate([...selection.target.nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return false
      }

      instance.commands.selection.replace({
        nodeIds: result.data.nodeIds
      })
      return true
    }
    case 'group.create': {
      const result = instance.commands.node.group.create([...selection.target.nodeIds])
      if (!result.ok) {
        return false
      }

      instance.commands.selection.replace({
        nodeIds: [result.data.groupId]
      })
      return true
    }
    case 'group.ungroup': {
      const groupIds = selection.target.nodeIds.filter((nodeId) =>
        selection.items.nodes.some((node) => node.id === nodeId && node.type === 'group')
      )
      const result = instance.commands.node.group.ungroupMany(groupIds)
      if (!result.ok) {
        return false
      }

      instance.commands.selection.replace({
        nodeIds: result.data.nodeIds
      })
      return true
    }
    case 'history.undo':
      return instance.commands.history.undo().ok
    case 'history.redo':
      return instance.commands.history.redo().ok
    default:
      return false
  }
}
