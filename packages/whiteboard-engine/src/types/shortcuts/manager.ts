import type {
  Shortcut,
  ShortcutContext,
  ShortcutKeyEvent,
  ShortcutPointerEvent
} from './index'

export type ShortcutOverrides = Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])

export type ShortcutManager = {
  setShortcuts: (shortcuts: Shortcut[]) => void
  register: (shortcut: Shortcut) => void
  unregister: (id: string) => void
  list: () => Shortcut[]
  handleKeyDown: (event: ShortcutKeyEvent, ctx: ShortcutContext) => boolean
  handlePointerDown: (event: ShortcutPointerEvent, ctx: ShortcutContext) => boolean
}

export type Shortcuts = {
  setShortcuts: (overrides?: ShortcutOverrides) => void
  getContext: () => ShortcutContext
  handleKeyDown: (event: ShortcutKeyEvent, context: ShortcutContext) => boolean
  handlePointerDownCapture: (event: ShortcutPointerEvent, context: ShortcutContext) => boolean
  dispose: () => void
}

export type ShortcutManagerOptions = {
  debug?: boolean
  logger?: (message: string, data?: unknown) => void
}
