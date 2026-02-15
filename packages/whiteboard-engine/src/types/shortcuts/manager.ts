import type { Shortcut, ShortcutContext } from './index'

export type ShortcutOverrides = Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])

export type ShortcutManager = {
  setShortcuts: (shortcuts: Shortcut[]) => void
  register: (shortcut: Shortcut) => void
  unregister: (id: string) => void
  list: () => Shortcut[]
  handleKeyDown: (event: KeyboardEvent, ctx: ShortcutContext) => boolean
  handlePointerDown: (event: PointerEvent, ctx: ShortcutContext) => boolean
}

export type Shortcuts = {
  setShortcuts: (overrides?: ShortcutOverrides) => void
  handleKeyDown: (event: KeyboardEvent, context: ShortcutContext) => boolean
  handlePointerDownCapture: (event: PointerEvent, context: ShortcutContext) => boolean
  dispose: () => void
}

export type ShortcutManagerOptions = {
  debug?: boolean
  logger?: (message: string, data?: unknown) => void
}
