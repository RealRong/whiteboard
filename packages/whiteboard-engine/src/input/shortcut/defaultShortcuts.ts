import type { Shortcut } from '@engine-types/shortcuts'

type ShortcutDependencies = {
  runCommand: (names: string[]) => boolean
}

export const createDefaultShortcuts = (deps: ShortcutDependencies): Shortcut[] => [
  {
    id: 'group.create',
    title: 'Group',
    category: 'group',
    keys: ['Mod+G'],
    when: (ctx) => ctx.selection.count >= 2 && !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['group.createFromSelection'])
    }
  },
  {
    id: 'group.ungroup',
    title: 'Ungroup',
    category: 'group',
    keys: ['Shift+Mod+G'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['group.ungroupSelection'])
    }
  },
  {
    id: 'selection.selectAll',
    title: 'Select All',
    category: 'edit',
    keys: ['Mod+A'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['selection.selectAll'])
    }
  },
  {
    id: 'selection.clear',
    title: 'Clear Selection',
    category: 'edit',
    keys: ['Escape'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['selection.clear'])
    }
  },
  {
    id: 'edit.delete',
    title: 'Delete',
    category: 'edit',
    keys: ['Backspace', 'Delete'],
    when: (ctx) => (ctx.selection.hasSelection || Boolean(ctx.selection.selectedEdgeId)) && !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['selection.delete'])
    }
  },
  {
    id: 'edit.duplicate',
    title: 'Duplicate',
    category: 'edit',
    keys: ['Mod+D'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['selection.duplicate'])
    }
  },
  {
    id: 'history.undo',
    title: 'Undo',
    category: 'edit',
    keys: ['Mod+Z'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['history.undo'])
    }
  },
  {
    id: 'history.redo',
    title: 'Redo',
    category: 'edit',
    keys: ['Shift+Mod+Z', 'Mod+Y'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      deps.runCommand(['history.redo'])
    }
  }
]
