import type {
  Shortcut,
  ShortcutContext,
  ShortcutKeyEvent,
  ShortcutPointerEvent
} from './types'
import type { KeyInputEvent, PointerInputEvent } from '../input/event'

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
  handleKeyDown: (event: KeyInputEvent) => boolean
  handlePointerDownCapture: (event: PointerInputEvent) => boolean
  dispose: () => void
}

export type ShortcutManagerOptions = {
  debug?: boolean
  logger?: (message: string, data?: unknown) => void
}
