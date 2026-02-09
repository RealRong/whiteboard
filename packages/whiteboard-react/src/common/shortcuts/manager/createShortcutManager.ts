import type {
  Shortcut,
  ShortcutContext,
  ShortcutManager,
  ShortcutManagerOptions
} from 'types/shortcuts'
import {
  countModifiers,
  getEventChord,
  normalizeShortcutChord,
  type PlatformInfo
} from './normalize'
import {
  compareCandidates,
  getPointerComplexity,
  isShortcutEnabled,
  type Candidate
} from './rules'

type NormalizedKeyInfo = {
  keys: string[]
  complexity: number
}

const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'

export const createShortcutManager = (
  initial: Shortcut[] = [],
  options: ShortcutManagerOptions = {}
): ShortcutManager => {
  let shortcuts = [...initial]
  const normalizedKeyCache = new WeakMap<Shortcut, Partial<Record<PlatformInfo['os'], NormalizedKeyInfo>>>()
  const debug = options.debug ?? isDev
  const logger = options.logger ?? (typeof console !== 'undefined' ? console.warn : undefined)

  const log = (message: string, data?: unknown) => {
    if (!debug || !logger) return
    logger(message, data)
  }

  const getNormalizedKeyInfo = (shortcut: Shortcut, platform: PlatformInfo): NormalizedKeyInfo => {
    const cached = normalizedKeyCache.get(shortcut)?.[platform.os]
    if (cached) return cached
    const keys = (shortcut.keys ?? [])
      .map((key) => normalizeShortcutChord(key, platform))
      .filter((key): key is string => Boolean(key))
    const info = {
      keys,
      complexity: keys.reduce((max, key) => Math.max(max, countModifiers(key)), 0)
    }
    const byPlatform = normalizedKeyCache.get(shortcut) ?? {}
    byPlatform[platform.os] = info
    normalizedKeyCache.set(shortcut, byPlatform)
    return info
  }

  const pickTarget = (candidates: Candidate[], conflictLabel: string, conflictData?: { chord?: string }) => {
    if (!candidates.length) return undefined
    const sorted = [...candidates].sort(compareCandidates)
    const target = sorted[0]?.shortcut
    if (!target) return undefined
    if (sorted.length > 1) {
      log(`Shortcut conflict (${conflictLabel})`, {
        ...(conflictData ?? {}),
        picked: target.id,
        candidates: sorted.map((item) => item.shortcut.id)
      })
    }
    return target
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
    const candidates: Candidate[] = []
    shortcuts.forEach((shortcut) => {
      if (!shortcut.keys?.length) return
      if (!isShortcutEnabled(shortcut, ctx)) return
      const normalized = getNormalizedKeyInfo(shortcut, ctx.platform)
      if (!normalized.keys.includes(chord)) return
      candidates.push({
        shortcut,
        complexity: normalized.complexity
      })
    })

    const target = pickTarget(candidates, 'keydown', { chord })
    if (!target) return false
    target.handler(ctx, event)
    return true
  }

  const handlePointerDown = (event: PointerEvent, ctx: ShortcutContext) => {
    const candidates: Candidate[] = []
    shortcuts.forEach((shortcut) => {
      const rule = shortcut.pointer
      if (!rule) return
      if (!isShortcutEnabled(shortcut, ctx)) return
      if (rule.button !== undefined && rule.button !== event.button) return
      if (rule.alt !== undefined && rule.alt !== event.altKey) return
      if (rule.shift !== undefined && rule.shift !== event.shiftKey) return
      if (rule.ctrl !== undefined && rule.ctrl !== event.ctrlKey) return
      if (rule.meta !== undefined && rule.meta !== event.metaKey) return
      candidates.push({
        shortcut,
        complexity: getPointerComplexity(shortcut)
      })
    })

    const target = pickTarget(candidates, 'pointer')
    if (!target) return false
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
