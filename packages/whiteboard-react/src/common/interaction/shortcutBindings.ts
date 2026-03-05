import type {
  ShortcutBinding,
  ShortcutOverrides
} from '@whiteboard/engine'

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
  const next = typeof overrides === 'function' ? overrides(defaults) : overrides
  return next
}
