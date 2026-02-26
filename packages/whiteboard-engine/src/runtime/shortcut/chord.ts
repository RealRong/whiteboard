import type { ShortcutContext, ShortcutKeyEvent } from '@engine-types/shortcuts'

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

export type PlatformInfo = ShortcutContext['platform']

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

export const normalizeKeyName = (key: string) => {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  return key
}

export const normalizeShortcutChord = (raw: string, platform: PlatformInfo): string | undefined => {
  const tokens = raw
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
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

export const getEventChord = (event: ShortcutKeyEvent): string | undefined => {
  const key = normalizeKeyName(event.key)
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return undefined
  const modifiers: string[] = []
  if (event.modifiers.ctrl) modifiers.push('Ctrl')
  if (event.modifiers.alt) modifiers.push('Alt')
  if (event.modifiers.shift) modifiers.push('Shift')
  if (event.modifiers.meta) modifiers.push('Meta')
  modifiers.push(key)
  return modifiers.join('+')
}

export const countModifiers = (chord: string) => chord.split('+').length - 1
