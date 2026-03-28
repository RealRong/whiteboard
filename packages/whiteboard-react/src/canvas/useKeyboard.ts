import { useEffect, useMemo, type RefObject } from 'react'
import {
  createShortcutMap,
  isKeyboardIgnoredTarget,
  readShortcut,
  resolveShortcutBindings
} from '@whiteboard/editor/input'
import type { ShortcutOverrides } from '../types/common/shortcut'
import { useInternalInstance } from '../runtime/hooks'
import {
  DefaultShortcutBindings,
  runShortcut
} from './shortcut'

export const useCanvasKeyboard = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  const instance = useInternalInstance()
  const bindings = useMemo(
    () => resolveShortcutBindings(DefaultShortcutBindings, shortcuts),
    [shortcuts]
  )
  const shortcutMap = useMemo(
    () => createShortcutMap(bindings),
    [bindings]
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
      if (isKeyboardIgnoredTarget(event.target)) {
        return
      }
      focusContainer()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isKeyboardIgnoredTarget(event.target)
      ) {
        return
      }

      if (instance.host.interaction.handleKeyDown(event)) {
        if (event.cancelable) {
          event.preventDefault()
        }
        event.stopPropagation()
        return
      }

      if (event.repeat) return

      const action = readShortcut(event, shortcutMap)
      if (!action) return
      if (!runShortcut(instance, action)) return

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isKeyboardIgnoredTarget(event.target)
      ) {
        if (event.code === 'Space' && instance.host.interaction.space.get()) {
          instance.host.interaction.handleKeyUp(event)
        }
        return
      }

      if (!instance.host.interaction.handleKeyUp(event)) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      instance.host.interaction.handleBlur()
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
