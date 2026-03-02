import type {
  PlatformInfo,
  ShortcutContext,
  ShortcutKeyEvent
} from '@engine-types/shortcuts/types'

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

export const platform = (): PlatformInfo => {
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

export const key = (value: string) => {
  if (value === ' ') return 'Space'
  if (value.length === 1) return value.toUpperCase()
  return value
}

export const chord = (raw: string, info: PlatformInfo): string | undefined => {
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
      modifiers.add(info.os === 'mac' ? 'Meta' : 'Ctrl')
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
    keyToken = key(token)
  })
  if (!keyToken) return undefined
  const ordered = MODIFIER_ORDER.filter((mod) => modifiers.has(mod))
  return [...ordered, keyToken].join('+')
}

export const eventChord = (event: ShortcutKeyEvent): string | undefined => {
  const normalized = key(event.key)
  if (normalized === 'Control' || normalized === 'Shift' || normalized === 'Alt' || normalized === 'Meta') return undefined
  const modifiers: string[] = []
  if (event.modifiers.ctrl) modifiers.push('Ctrl')
  if (event.modifiers.alt) modifiers.push('Alt')
  if (event.modifiers.shift) modifiers.push('Shift')
  if (event.modifiers.meta) modifiers.push('Meta')
  modifiers.push(normalized)
  return modifiers.join('+')
}

export const mods = (value: string) => value.split('+').length - 1
