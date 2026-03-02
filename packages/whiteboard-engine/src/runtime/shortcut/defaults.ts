import type { Shortcut, ShortcutAction } from '@engine-types/shortcuts/types'

type ShortcutDependencies = {
  runAction: (action: ShortcutAction) => boolean
}

export const defaults = (deps: ShortcutDependencies): Shortcut[] => [
  {
    id: 'group.create',
    title: 'Group',
    category: 'group',
    keys: ['Mod+G'],
    when: (ctx) => ctx.selection.count >= 2 && !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('group.create')
    }
  },
  {
    id: 'group.ungroup',
    title: 'Ungroup',
    category: 'group',
    keys: ['Shift+Mod+G'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('group.ungroup')
    }
  },
  {
    id: 'selection.selectAll',
    title: 'Select All',
    category: 'edit',
    keys: ['Mod+A'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('selection.selectAll')
    }
  },
  {
    id: 'selection.clear',
    title: 'Clear Selection',
    category: 'edit',
    keys: ['Escape'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('selection.clear')
    }
  },
  {
    id: 'edit.delete',
    title: 'Delete',
    category: 'edit',
    keys: ['Backspace', 'Delete'],
    when: (ctx) => (ctx.selection.hasSelection || Boolean(ctx.selection.selectedEdgeId)) && !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('selection.delete')
    }
  },
  {
    id: 'edit.duplicate',
    title: 'Duplicate',
    category: 'edit',
    keys: ['Mod+D'],
    when: (ctx) => ctx.selection.hasSelection && !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('selection.duplicate')
    }
  },
  {
    id: 'history.undo',
    title: 'Undo',
    category: 'edit',
    keys: ['Mod+Z'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('history.undo')
    }
  },
  {
    id: 'history.redo',
    title: 'Redo',
    category: 'edit',
    keys: ['Shift+Mod+Z', 'Mod+Y'],
    when: (ctx) => !ctx.focus.isEditingText,
    handler: () => {
      deps.runAction('history.redo')
    }
  }
]
