import type { Shortcut, ShortcutContext } from './index'

export type ShortcutManager = {
  setShortcuts: (shortcuts: Shortcut[]) => void
  register: (shortcut: Shortcut) => void
  unregister: (id: string) => void
  list: () => Shortcut[]
  handleKeyDown: (event: KeyboardEvent, ctx: ShortcutContext) => boolean
  handlePointerDown: (event: PointerEvent, ctx: ShortcutContext) => boolean
}

export type ShortcutManagerOptions = {
  debug?: boolean
  logger?: (message: string, data?: unknown) => void
}
