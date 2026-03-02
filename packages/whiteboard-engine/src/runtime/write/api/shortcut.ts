import type { ShortcutAction } from '@engine-types/shortcuts/types'
import type {
  SelectionCommandsApi,
  ShortcutActionDispatcher
} from '@engine-types/write/commands'

export const shortcut = ({
  selection,
  history
}: {
  selection: Pick<
    SelectionCommandsApi,
    'selectAll' | 'clear' | 'groupSelected' | 'ungroupSelected' | 'deleteSelected' | 'duplicateSelected'
  >
  history: {
    undo: () => boolean
    redo: () => boolean
  }
}): ShortcutActionDispatcher => {
  const execute = (action: ShortcutAction): boolean => {
    switch (action) {
      case 'selection.selectAll':
        selection.selectAll()
        return true
      case 'selection.clear':
        selection.clear()
        return true
      case 'selection.delete':
        void selection.deleteSelected()
        return true
      case 'selection.duplicate':
        void selection.duplicateSelected()
        return true
      case 'group.create':
        void selection.groupSelected()
        return true
      case 'group.ungroup':
        void selection.ungroupSelected()
        return true
      case 'history.undo':
        history.undo()
        return true
      case 'history.redo':
        history.redo()
        return true
      default:
        return false
    }
  }

  return { execute }
}
