import { useEffect, useMemo, type RefObject } from 'react'
import type {
  ShortcutAction,
  ShortcutOverrides
} from '../types/common/shortcut'
import { useInternalInstance } from '../runtime/hooks'
import {
  DEFAULT_SHORTCUT_BINDINGS,
  dispatchCanvasShortcutAction,
  resolveShortcutBindings
} from './actions'
import {
  isEditableTarget,
  isInputIgnoredTarget
} from './CanvasTargeting'

const ModifierOrder = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

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

const normalizeBindingChord = (
  raw: string,
  platform: Platform
): string | undefined => {
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
  return [...ModifierOrder.filter((modifier) => modifiers.has(modifier)), keyToken].join('+')
}

const chordFromKeyboardEvent = (
  event: KeyboardEvent
): string | undefined => {
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

const createShortcutMap = (
  bindings: readonly { key: string; action: ShortcutAction }[],
  platform: Platform
) => {
  const map = new Map<string, ShortcutAction>()
  bindings.forEach((binding) => {
    const normalized = normalizeBindingChord(binding.key, platform)
    if (!normalized) return
    map.set(normalized, binding.action)
  })
  return map
}

export const useCanvasKeyboard = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  const instance = useInternalInstance()
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

    const focusContainer = () => {
      if (document.activeElement === container) {
        return
      }
      container.focus({ preventScroll: true })
    }

    const onPointerDown = (event: PointerEvent) => {
      if (isEditableTarget(event.target) || isInputIgnoredTarget(event.target)) {
        return
      }
      focusContainer()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
      ) {
        return
      }

      if (instance.interaction.handleKeyDown(event)) {
        if (event.cancelable) {
          event.preventDefault()
        }
        event.stopPropagation()
        return
      }

      if (event.repeat) return

      const chord = chordFromKeyboardEvent(event)
      if (!chord) return

      const action = shortcutMap.get(chord)
      if (!action) return
      if (!dispatchCanvasShortcutAction(instance, action)) return

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
      ) {
        if (event.code === 'Space' && instance.interaction.space.get()) {
          instance.interaction.handleKeyUp(event)
        }
        return
      }

      if (!instance.interaction.handleKeyUp(event)) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      instance.interaction.handleBlur()
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('keydown', onKeyDown)
    container.addEventListener('keyup', onKeyUp)
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur)
    }

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('keydown', onKeyDown)
      container.removeEventListener('keyup', onKeyUp)
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur)
      }
    }
  }, [containerRef, instance, shortcutMap])
}
