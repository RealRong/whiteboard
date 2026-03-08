import { useEffect, useMemo, type RefObject } from 'react'
import type { ShortcutAction, ShortcutOverrides } from '../../types/common/shortcut'
import type { WhiteboardInstance } from '../instance'
import { DEFAULT_SHORTCUT_BINDINGS, resolveShortcutBindings } from './shortcutBindings'
import { dispatchShortcutAction } from './shortcutDispatch'

type UseShortcutDispatchOptions = {
  instance: WhiteboardInstance
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

type Platform = 'mac' | 'win' | 'linux'

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'win'
  const value = navigator.platform.toLowerCase()
  if (value.includes('mac')) return 'mac'
  if (value.includes('win')) return 'win'
  return 'linux'
}

const normalizeKey = (value: string) => {
  if (value === ' ') return 'Space'
  if (value.length === 1) return value.toUpperCase()
  return value
}

const normalizeBindingChord = (raw: string, platform: Platform): string | undefined => {
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
      modifiers.add(platform === 'mac' ? 'Meta' : 'Ctrl')
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
    keyToken = normalizeKey(token)
  })

  if (!keyToken) return undefined
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))
  return [...orderedModifiers, keyToken].join('+')
}

const chordFromKeyboardEvent = (event: KeyboardEvent): string | undefined => {
  const normalized = normalizeKey(event.key)
  if (
    normalized === 'Control'
    || normalized === 'Shift'
    || normalized === 'Alt'
    || normalized === 'Meta'
  ) {
    return undefined
  }

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  parts.push(normalized)
  return parts.join('+')
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return false
  }
  return true
}

const createShortcutMap = (
  bindings: readonly { key: string; action: ShortcutAction }[],
  platform: Platform
): Map<string, ShortcutAction> => {
  const map = new Map<string, ShortcutAction>()
  bindings.forEach((binding) => {
    const normalized = normalizeBindingChord(binding.key, platform)
    if (!normalized) return
    map.set(normalized, binding.action)
  })
  return map
}

export const useShortcutDispatch = ({
  instance,
  containerRef,
  shortcuts
}: UseShortcutDispatchOptions) => {
  const platform = useMemo(() => detectPlatform(), [])
  const bindings = useMemo(
    () => resolveShortcutBindings(DEFAULT_SHORTCUT_BINDINGS, shortcuts),
    [shortcuts]
  )
  const shortcutMap = useMemo(
    () => createShortcutMap(bindings, platform),
    [bindings, platform]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) {
        return
      }
      const chord = chordFromKeyboardEvent(event)
      if (!chord) return
      const action = shortcutMap.get(chord)
      if (!action) return
      const handled = dispatchShortcutAction(instance, action)
      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
    }
  }, [containerRef, instance, shortcutMap])
}
