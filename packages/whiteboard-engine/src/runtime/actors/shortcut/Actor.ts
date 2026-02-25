import type { ShortcutAction } from '@engine-types/shortcuts'
import type { Actor as SelectionActor } from '../../../domains/selection/commands/Actor'

type ActorOptions = {
  selection: Pick<
    SelectionActor,
    'selectAll' | 'clear' | 'groupSelected' | 'ungroupSelected' | 'deleteSelected' | 'duplicateSelected'
  >
  history: {
    undo: () => boolean
    redo: () => boolean
  }
}

export class Actor {
  readonly name = 'Shortcut'

  private readonly selection: ActorOptions['selection']
  private readonly history: ActorOptions['history']

  constructor({ selection, history }: ActorOptions) {
    this.selection = selection
    this.history = history
  }

  execute = (action: ShortcutAction): boolean => {
    switch (action) {
      case 'selection.selectAll':
        this.selection.selectAll()
        return true
      case 'selection.clear':
        this.selection.clear()
        return true
      case 'selection.delete':
        void this.selection.deleteSelected()
        return true
      case 'selection.duplicate':
        void this.selection.duplicateSelected()
        return true
      case 'group.create':
        void this.selection.groupSelected()
        return true
      case 'group.ungroup':
        void this.selection.ungroupSelected()
        return true
      case 'history.undo':
        this.history.undo()
        return true
      case 'history.redo':
        this.history.redo()
        return true
      default:
        return false
    }
  }
}
