import type { ShortcutAction } from '@engine-types/shortcuts/types'
import type { Commands } from '@engine-types/command/api'
import type { State } from '@engine-types/instance/state'

export const createShortcutCommands = ({
  state,
  selection,
  history
}: {
  state: Pick<State, 'read'>
  selection: Pick<
    Commands['selection'],
    | 'selectAll'
    | 'clear'
    | 'groupSelected'
    | 'ungroupSelected'
    | 'deleteSelected'
    | 'duplicateSelected'
  >
  history: Pick<Commands['history'], 'undo' | 'redo'>
}): Commands['shortcut'] => {
  const canDispatch = (action: ShortcutAction): boolean => {
    const interaction = state.read('interaction')
    const focus = interaction.focus
    if (focus.isEditingText || focus.isInputFocused || focus.isImeComposing) {
      return false
    }

    const selectionState = state.read('selection')
    const selectedNodeCount = selectionState.selectedNodeIds.size
    const hasSelection = selectedNodeCount > 0
    const selectedEdgeId = selectionState.selectedEdgeId

    switch (action) {
      case 'group.create':
        return selectedNodeCount >= 2
      case 'group.ungroup':
        return hasSelection
      case 'selection.selectAll':
        return true
      case 'selection.clear':
        return hasSelection
      case 'selection.delete':
        return hasSelection || Boolean(selectedEdgeId)
      case 'selection.duplicate':
        return hasSelection
      case 'history.undo':
      case 'history.redo':
        return true
      default:
        return false
    }
  }

  const dispatch = (action: ShortcutAction): boolean => {
    if (!canDispatch(action)) return false

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
        return history.undo()
      case 'history.redo':
        return history.redo()
      default:
        return false
    }
  }

  return { dispatch }
}
