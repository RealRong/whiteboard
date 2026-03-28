import type {
  ShortcutAction,
  ShortcutBinding
} from '../types/common/shortcut'
import type { Editor } from '../runtime/editor'

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
  editor: Editor
) => {
  const selection = editor.read.selection.get()
  const can = editor.read.context.selection.get()?.can

  return {
    selection,
    can,
    pureNode: selection.items.edgeCount === 0,
    hasSelection: selection.items.count > 0
  }
}

const canRunShortcut = (
  editor: Editor,
  action: ShortcutAction,
  state: ShortcutState
) => {
  switch (action) {
    case 'group.create':
      return state.pureNode && Boolean(state.can?.makeGroup)
    case 'group.ungroup':
      return state.pureNode && Boolean(state.can?.ungroup)
    case 'selection.selectAll':
      return true
    case 'selection.clear':
      return (
        state.hasSelection
        || editor.read.frame.scope.get().id !== undefined
        || !editor.read.tool.is('select')
      )
    case 'selection.delete':
      return state.hasSelection
    case 'selection.duplicate':
      return state.pureNode && Boolean(state.can?.duplicate)
    case 'history.undo':
    case 'history.redo':
      return true
    default:
      return false
  }
}

export const runShortcut = (
  editor: Editor,
  action: ShortcutAction
) => {
  const state = readShortcutState(editor)
  if (!canRunShortcut(editor, action, state)) {
    return false
  }

  const { selection } = state

  switch (action) {
    case 'selection.selectAll':
      editor.commands.selection.selectAll()
      return true
    case 'selection.clear':
      if (!editor.read.tool.is('select')) {
        editor.commands.tool.select()
      }
      editor.commands.frame.exit()
      return true
    case 'selection.delete':
      if (selection.target.edgeIds.length > 0) {
        const result = editor.commands.edge.delete([...selection.target.edgeIds])
        if (!result.ok) {
          return false
        }
      }

      if (selection.target.nodeIds.length > 0) {
        const result = editor.commands.node.deleteCascade([...selection.target.nodeIds])
        if (!result.ok) {
          return false
        }
      }

      return true
    case 'selection.duplicate': {
      const result = editor.commands.node.duplicate([...selection.target.nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return false
      }

      editor.commands.selection.replace({
        nodeIds: result.data.nodeIds
      })
      return true
    }
    case 'group.create': {
      const result = editor.commands.node.group.create([...selection.target.nodeIds])
      if (!result.ok) {
        return false
      }

      editor.commands.selection.replace({
        nodeIds: [result.data.groupId]
      })
      return true
    }
    case 'group.ungroup': {
      const groupIds = selection.target.nodeIds.filter((nodeId) =>
        selection.items.nodes.some((node) => node.id === nodeId && node.type === 'group')
      )
      const result = editor.commands.node.group.ungroupMany(groupIds)
      if (!result.ok) {
        return false
      }

      editor.commands.selection.replace({
        nodeIds: result.data.nodeIds
      })
      return true
    }
    case 'history.undo':
      return editor.commands.history.undo().ok
    case 'history.redo':
      return editor.commands.history.redo().ok
    default:
      return false
  }
}
