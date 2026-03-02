import type {
  PlatformInfo,
  Shortcut,
  ShortcutContext,
  ShortcutKeyEvent,
  ShortcutPointerEvent,
} from '@engine-types/shortcuts/types'
import type {
  ShortcutManager,
  ShortcutManagerOptions,
  ShortcutOverrides
} from '@engine-types/shortcuts/manager'
import {
  mods,
  eventChord,
  chord
} from './chord'

type KeyInfo = {
  keys: string[]
  complexity: number
}

type Candidate = {
  shortcut: Shortcut
  complexity: number
}

type PointerCandidate = Candidate & {
  rule: NonNullable<Shortcut['pointer']>
}

type Indexes = {
  keyByOs: Record<PlatformInfo['os'], Map<string, Candidate[]>>
  pointer: PointerCandidate[]
}

const OS: Record<PlatformInfo['os'], PlatformInfo> = {
  mac: { os: 'mac', metaKeyLabel: 'cmd' },
  win: { os: 'win', metaKeyLabel: 'ctrl' },
  linux: { os: 'linux', metaKeyLabel: 'ctrl' }
}

const emptyKeys = (): Indexes['keyByOs'] => ({
  mac: new Map(),
  win: new Map(),
  linux: new Map()
})

const enabled = (shortcut: Shortcut, ctx: ShortcutContext) => {
  if (shortcut.when && !shortcut.when(ctx)) return false
  if (ctx.focus.isEditingText || ctx.focus.isInputFocused) {
    return Boolean(shortcut.allowWhenEditing)
  }
  return true
}

const compare = (a: Candidate, b: Candidate) => {
  const priorityDelta = (b.shortcut.priority ?? 0) - (a.shortcut.priority ?? 0)
  if (priorityDelta !== 0) return priorityDelta
  return b.complexity - a.complexity
}

const pointerMods = (shortcut: Shortcut) => {
  const rule = shortcut.pointer
  if (!rule) return 0
  return (
    Number(Boolean(rule.alt)) +
    Number(Boolean(rule.shift)) +
    Number(Boolean(rule.ctrl)) +
    Number(Boolean(rule.meta))
  )
}

const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'

export const resolveShortcuts = (
  defaults: Shortcut[],
  overrides?: ShortcutOverrides
) => {
  if (!overrides) return defaults
  if (typeof overrides === 'function') {
    return overrides(defaults)
  }
  const merged = new Map<string, Shortcut>()
  defaults.forEach((shortcut) => merged.set(shortcut.id, shortcut))
  overrides.forEach((shortcut) => merged.set(shortcut.id, shortcut))
  return Array.from(merged.values())
}

export const manager = (
  initial: Shortcut[] = [],
  options: ShortcutManagerOptions = {}
): ShortcutManager => {
  let shortcuts = [...initial]
  const keyCache = new WeakMap<Shortcut, Partial<Record<PlatformInfo['os'], KeyInfo>>>()
  let indexes: Indexes = {
    keyByOs: emptyKeys(),
    pointer: []
  }

  const debug = options.debug ?? isDev
  const logger = options.logger ?? (typeof console !== 'undefined' ? console.warn : undefined)

  const log = (message: string, data?: unknown) => {
    if (!debug || !logger) return
    logger(message, data)
  }

  const keyInfo = (shortcut: Shortcut, platform: PlatformInfo): KeyInfo => {
    const cached = keyCache.get(shortcut)?.[platform.os]
    if (cached) return cached
    const keys = (shortcut.keys ?? [])
      .map((key) => chord(key, platform))
      .filter((key): key is string => Boolean(key))
    const info = {
      keys,
      complexity: keys.reduce((max, key) => Math.max(max, mods(key)), 0)
    }
    const byPlatform = keyCache.get(shortcut) ?? {}
    byPlatform[platform.os] = info
    keyCache.set(shortcut, byPlatform)
    return info
  }

  const compile = (next: Shortcut[]) => {
    shortcuts = [...next]

    const keyByOs = emptyKeys()
    const pointer: PointerCandidate[] = []

    shortcuts.forEach((shortcut) => {
      if (shortcut.keys?.length) {
        ;(Object.keys(OS) as PlatformInfo['os'][]).forEach((os) => {
          const normalized = keyInfo(shortcut, OS[os])
          if (!normalized.keys.length) return
          normalized.keys.forEach((chord) => {
            const list = keyByOs[os].get(chord)
            const candidate: Candidate = {
              shortcut,
              complexity: normalized.complexity
            }
            if (list) {
              list.push(candidate)
            } else {
              keyByOs[os].set(chord, [candidate])
            }
          })
        })
      }

      if (shortcut.pointer) {
        pointer.push({
          shortcut,
          complexity: pointerMods(shortcut),
          rule: shortcut.pointer
        })
      }
    })

    ;(Object.keys(keyByOs) as PlatformInfo['os'][]).forEach((os) => {
      keyByOs[os].forEach((list) => {
        list.sort(compare)
      })
    })
    pointer.sort(compare)

    indexes = {
      keyByOs,
      pointer
    }
  }

  const pick = (candidates: Candidate[], label: string, data?: { chord?: string }) => {
    if (!candidates.length) return undefined
    const first = candidates[0]?.shortcut
    if (!first) return undefined
    if (candidates.length > 1) {
      log(`Shortcut conflict (${label})`, {
        ...(data ?? {}),
        picked: first.id,
        candidates: candidates.map((item) => item.shortcut.id)
      })
    }
    return first
  }

  const setShortcuts = (next: Shortcut[]) => {
    compile(next)
  }

  const register = (shortcut: Shortcut) => {
    compile([...shortcuts, shortcut])
  }

  const unregister = (id: string) => {
    compile(shortcuts.filter((shortcut) => shortcut.id !== id))
  }

  const list = () => shortcuts

  const handleKeyDown = (event: ShortcutKeyEvent, ctx: ShortcutContext) => {
    if (ctx.focus.isImeComposing) return false
    const value = eventChord(event)
    if (!value) return false

    const hits = indexes.keyByOs[ctx.platform.os].get(value)
    if (!hits?.length) return false

    const candidates = hits.filter((candidate) => enabled(candidate.shortcut, ctx))
    const target = pick(candidates, 'keydown', { chord: value })
    if (!target) return false
    target.handler(ctx, event)
    return true
  }

  const handlePointerDown = (event: ShortcutPointerEvent, ctx: ShortcutContext) => {
    const candidates: Candidate[] = []

    indexes.pointer.forEach((candidate) => {
      const rule = candidate.rule
      if (!enabled(candidate.shortcut, ctx)) return
      if (rule.button !== undefined && rule.button !== event.button) return
      if (rule.alt !== undefined && rule.alt !== event.modifiers.alt) return
      if (rule.shift !== undefined && rule.shift !== event.modifiers.shift) return
      if (rule.ctrl !== undefined && rule.ctrl !== event.modifiers.ctrl) return
      if (rule.meta !== undefined && rule.meta !== event.modifiers.meta) return

      candidates.push({
        shortcut: candidate.shortcut,
        complexity: candidate.complexity
      })
    })

    const target = pick(candidates, 'pointer')
    if (!target) return false
    target.handler(ctx, event)
    return true
  }

  compile(shortcuts)

  return {
    setShortcuts,
    register,
    unregister,
    list,
    handleKeyDown,
    handlePointerDown
  }
}
