import { useEffect, useMemo, type RefObject } from 'react'
import type {
  Instance,
  ShortcutAction,
  ShortcutOverrides
} from '@whiteboard/engine'
import { DEFAULT_SHORTCUT_BINDINGS, resolveShortcutBindings } from './shortcutBindings'
import { dispatchShortcutAction } from './shortcutDispatch'

type UseShortcutDispatchOptions = {
  instance: Instance
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

  const tokens: string[] = []
  if (event.ctrlKey) tokens.push('Ctrl')
  if (event.altKey) tokens.push('Alt')
  if (event.shiftKey) tokens.push('Shift')
  if (event.metaKey) tokens.push('Meta')
  tokens.push(normalized)
  return tokens.join('+')
}

const isTextInput = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    const type = (target.type || 'text').toLowerCase()
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type)
  }
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable=""], [contenteditable="true"]'))
}

const isInsideContainer = (target: EventTarget | null, container: HTMLDivElement): boolean => {
  if (!(target instanceof Node)) return false
  return container.contains(target)
}

const createKeyActionMap = (
  shortcuts: readonly {
    key: string
    action: ShortcutAction
  }[]
): Map<string, ShortcutAction> => {
  const platform = detectPlatform()
  const map = new Map<string, ShortcutAction>()
  shortcuts.forEach((item) => {
    const chord = normalizeBindingChord(item.key, platform)
    if (!chord) return
    map.set(chord, item.action)
  })
  return map
}

export const useShortcutDispatch = ({
  instance,
  containerRef,
  shortcuts
}: UseShortcutDispatchOptions) => {
  const bindings = useMemo(
    () => resolveShortcutBindings(DEFAULT_SHORTCUT_BINDINGS, shortcuts),
    [shortcuts]
  )
  const keyActionMap = useMemo(() => createKeyActionMap(bindings), [bindings])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const container = containerRef.current
      if (!container) return
      if (!isInsideContainer(event.target, container)) return
      if (isTextInput(event.target)) return

      const chord = chordFromKeyboardEvent(event)
      if (!chord) return
      const action = keyActionMap.get(chord)
      if (!action) return

      const handled = dispatchShortcutAction(instance, action)
      if (!handled) return

      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [instance, containerRef, keyActionMap])
}
