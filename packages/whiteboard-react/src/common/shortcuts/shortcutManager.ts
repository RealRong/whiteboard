import type {
  Shortcut,
  ShortcutContext,
  ShortcutManager,
  ShortcutManagerOptions
} from 'types/shortcuts'


const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

type PlatformInfo = ShortcutContext['platform']

export const getPlatformInfo = (): PlatformInfo => {
  if (typeof navigator === 'undefined') {
    return { os: 'win', metaKeyLabel: 'ctrl' }
  }
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('mac')) {
    return { os: 'mac', metaKeyLabel: 'cmd' }
  }
  if (platform.includes('win')) {
    return { os: 'win', metaKeyLabel: 'ctrl' }
  }
  return { os: 'linux', metaKeyLabel: 'ctrl' }
}

const normalizeKeyName = (key: string) => {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  return key
}

const normalizeShortcutChord = (raw: string, platform: PlatformInfo): string | undefined => {
  const tokens = raw.split('+').map((token) => token.trim()).filter(Boolean)
  if (!tokens.length) return undefined
  let keyToken: string | undefined
  const modifiers = new Set<string>()
  tokens.forEach((token) => {
    const lowered = token.toLowerCase()
    if (lowered === 'mod') {
      modifiers.add(platform.os === 'mac' ? 'Meta' : 'Ctrl')
      return
    }
    if (lowered === 'ctrl' || lowered === 'control') {
      modifiers.add('Ctrl')
      return
    }
    if (lowered === 'meta' || lowered === 'cmd' || lowered === 'command') {
      modifiers.add('Meta')
      return
    }
    if (lowered === 'alt' || lowered === 'option') {
      modifiers.add('Alt')
      return
    }
    if (lowered === 'shift') {
      modifiers.add('Shift')
      return
    }
    keyToken = normalizeKeyName(token)
  })
  if (!keyToken) return undefined
  const ordered = MODIFIER_ORDER.filter((mod) => modifiers.has(mod))
  return [...ordered, keyToken].join('+')
}

const getEventChord = (event: KeyboardEvent): string | undefined => {
  const key = normalizeKeyName(event.key)
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return undefined
  const mods: string[] = []
  if (event.ctrlKey) mods.push('Ctrl')
  if (event.altKey) mods.push('Alt')
  if (event.shiftKey) mods.push('Shift')
  if (event.metaKey) mods.push('Meta')
  mods.push(key)
  return mods.join('+')
}

const countModifiers = (chord: string) => chord.split('+').length - 1

const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'

export const createShortcutManager = (
  initial: Shortcut[] = [],
  options: ShortcutManagerOptions = {}
): ShortcutManager => {
  let shortcuts = [...initial]
  const debug = options.debug ?? isDev
  const logger = options.logger ?? (typeof console !== 'undefined' ? console.warn : undefined)

  const log = (message: string, data?: unknown) => {
    if (!debug || !logger) return
    logger(message, data)
  }

  const setShortcuts = (next: Shortcut[]) => {
    shortcuts = [...next]
  }

  const register = (shortcut: Shortcut) => {
    shortcuts = [...shortcuts, shortcut]
  }

  const unregister = (id: string) => {
    shortcuts = shortcuts.filter((shortcut) => shortcut.id !== id)
  }

  const list = () => shortcuts

  const handleKeyDown = (event: KeyboardEvent, ctx: ShortcutContext) => {
    if (ctx.focus.isImeComposing) return false
    const chord = getEventChord(event)
    if (!chord) return false
    const candidates = shortcuts
      .filter((shortcut) => shortcut.keys && shortcut.keys.length > 0)
      .filter((shortcut) => (shortcut.when ? shortcut.when(ctx) : true))
      .filter((shortcut) => (ctx.focus.isEditingText || ctx.focus.isInputFocused) ? shortcut.allowWhenEditing : true)
      .map((shortcut) => {
        const normalized = (shortcut.keys ?? [])
          .map((key) => normalizeShortcutChord(key, ctx.platform))
          .filter((key): key is string => Boolean(key))
        return {
          shortcut,
          matches: normalized.includes(chord),
          complexity: normalized.reduce((max, key) => Math.max(max, countModifiers(key)), 0)
        }
      })
      .filter((item) => item.matches)

    if (!candidates.length) return false
    const sorted = candidates.sort((a, b) => {
      const priorityDelta = (b.shortcut.priority ?? 0) - (a.shortcut.priority ?? 0)
      if (priorityDelta !== 0) return priorityDelta
      return b.complexity - a.complexity
    })
    const target = sorted[0]?.shortcut
    if (!target) return false
    if (sorted.length > 1) {
      log('Shortcut conflict (keydown)', {
        chord,
        picked: target.id,
        candidates: sorted.map((item) => item.shortcut.id)
      })
    }
    target.handler(ctx, event)
    return true
  }

  const handlePointerDown = (event: PointerEvent, ctx: ShortcutContext) => {
    const candidates = shortcuts
      .filter((shortcut) => shortcut.pointer)
      .filter((shortcut) => (shortcut.when ? shortcut.when(ctx) : true))
      .filter((shortcut) =>
        ctx.focus.isEditingText || ctx.focus.isInputFocused ? shortcut.allowWhenEditing : true
      )
      .map((shortcut) => {
        const rule = shortcut.pointer
        if (!rule) return { shortcut, matches: false, complexity: 0 }
        if (rule.button !== undefined && rule.button !== event.button) {
          return { shortcut, matches: false, complexity: 0 }
        }
        if (rule.alt !== undefined && rule.alt !== event.altKey) {
          return { shortcut, matches: false, complexity: 0 }
        }
        if (rule.shift !== undefined && rule.shift !== event.shiftKey) {
          return { shortcut, matches: false, complexity: 0 }
        }
        if (rule.ctrl !== undefined && rule.ctrl !== event.ctrlKey) {
          return { shortcut, matches: false, complexity: 0 }
        }
        if (rule.meta !== undefined && rule.meta !== event.metaKey) {
          return { shortcut, matches: false, complexity: 0 }
        }
        const complexity =
          Number(Boolean(rule.alt)) +
          Number(Boolean(rule.shift)) +
          Number(Boolean(rule.ctrl)) +
          Number(Boolean(rule.meta))
        return { shortcut, matches: true, complexity }
      })
      .filter((item) => item.matches)

    if (!candidates.length) return false
    const sorted = candidates.sort((a, b) => {
      const priorityDelta = (b.shortcut.priority ?? 0) - (a.shortcut.priority ?? 0)
      if (priorityDelta !== 0) return priorityDelta
      return b.complexity - a.complexity
    })
    const target = sorted[0]?.shortcut
    if (!target) return false
    if (sorted.length > 1) {
      log('Shortcut conflict (pointer)', {
        picked: target.id,
        candidates: sorted.map((item) => item.shortcut.id)
      })
    }
    target.handler(ctx, event)
    return true
  }

  return {
    setShortcuts,
    register,
    unregister,
    list,
    handleKeyDown,
    handlePointerDown
  }
}
