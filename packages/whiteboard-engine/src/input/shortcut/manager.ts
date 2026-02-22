import type {
  Shortcut,
  ShortcutContext,
  ShortcutManager,
  ShortcutKeyEvent,
  ShortcutPointerEvent,
  ShortcutManagerOptions
} from '@engine-types/shortcuts'
import {
  countModifiers,
  getEventChord,
  normalizeShortcutChord,
  type PlatformInfo
} from './chord'
import {
  compareCandidates,
  getPointerComplexity,
  isShortcutEnabled,
  type Candidate
} from './rule'

type NormalizedKeyInfo = {
  keys: string[]
  complexity: number
}

type ShortcutPointerCandidate = Candidate & {
  rule: NonNullable<Shortcut['pointer']>
}

type CompiledShortcutIndexes = {
  keyByOs: Record<PlatformInfo['os'], Map<string, Candidate[]>>
  pointer: ShortcutPointerCandidate[]
}

const PLATFORM_BY_OS: Record<PlatformInfo['os'], PlatformInfo> = {
  mac: { os: 'mac', metaKeyLabel: 'cmd' },
  win: { os: 'win', metaKeyLabel: 'ctrl' },
  linux: { os: 'linux', metaKeyLabel: 'ctrl' }
}

const createEmptyKeyIndex = (): CompiledShortcutIndexes['keyByOs'] => ({
  mac: new Map(),
  win: new Map(),
  linux: new Map()
})

const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'

export const createShortcutManager = (
  initial: Shortcut[] = [],
  options: ShortcutManagerOptions = {}
): ShortcutManager => {
  let shortcuts = [...initial]
  const normalizedKeyCache = new WeakMap<Shortcut, Partial<Record<PlatformInfo['os'], NormalizedKeyInfo>>>()
  let compiled: CompiledShortcutIndexes = {
    keyByOs: createEmptyKeyIndex(),
    pointer: []
  }

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

  const compileShortcuts = (next: Shortcut[]) => {
    shortcuts = [...next]

    const keyByOs = createEmptyKeyIndex()
    const pointer: ShortcutPointerCandidate[] = []

    shortcuts.forEach((shortcut) => {
      if (shortcut.keys?.length) {
        ;(Object.keys(PLATFORM_BY_OS) as PlatformInfo['os'][]).forEach((os) => {
          const normalized = getNormalizedKeyInfo(shortcut, PLATFORM_BY_OS[os])
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
          complexity: getPointerComplexity(shortcut),
          rule: shortcut.pointer
        })
      }
    })

    ;(Object.keys(keyByOs) as PlatformInfo['os'][]).forEach((os) => {
      keyByOs[os].forEach((list) => {
        list.sort(compareCandidates)
      })
    })
    pointer.sort(compareCandidates)

    compiled = {
      keyByOs,
      pointer
    }
  }

  const pickTarget = (candidates: Candidate[], conflictLabel: string, conflictData?: { chord?: string }) => {
    if (!candidates.length) return undefined
    const target = candidates[0]?.shortcut
    if (!target) return undefined
    if (candidates.length > 1) {
      log(`Shortcut conflict (${conflictLabel})`, {
        ...(conflictData ?? {}),
        picked: target.id,
        candidates: candidates.map((item) => item.shortcut.id)
      })
    }
    return target
  }

  const setShortcuts = (next: Shortcut[]) => {
    compileShortcuts(next)
  }

  const register = (shortcut: Shortcut) => {
    compileShortcuts([...shortcuts, shortcut])
  }

  const unregister = (id: string) => {
    compileShortcuts(shortcuts.filter((shortcut) => shortcut.id !== id))
  }

  const list = () => shortcuts

  const handleKeyDown = (event: ShortcutKeyEvent, ctx: ShortcutContext) => {
    if (ctx.focus.isImeComposing) return false
    const chord = getEventChord(event)
    if (!chord) return false

    const indexedCandidates = compiled.keyByOs[ctx.platform.os].get(chord)
    if (!indexedCandidates?.length) return false

    const candidates = indexedCandidates.filter((candidate) => isShortcutEnabled(candidate.shortcut, ctx))
    const target = pickTarget(candidates, 'keydown', { chord })
    if (!target) return false
    target.handler(ctx, event)
    return true
  }

  const handlePointerDown = (event: ShortcutPointerEvent, ctx: ShortcutContext) => {
    const candidates: Candidate[] = []

    compiled.pointer.forEach((candidate) => {
      const rule = candidate.rule
      if (!isShortcutEnabled(candidate.shortcut, ctx)) return
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

    const target = pickTarget(candidates, 'pointer')
    if (!target) return false
    target.handler(ctx, event)
    return true
  }

  compileShortcuts(shortcuts)

  return {
    setShortcuts,
    register,
    unregister,
    list,
    handleKeyDown,
    handlePointerDown
  }
}
