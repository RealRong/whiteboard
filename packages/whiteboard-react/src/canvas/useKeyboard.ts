import { useEffect, useMemo, type RefObject } from 'react'
import {
  createShortcutMap,
  readShortcut,
  resolveShortcutBindings
} from '@whiteboard/editor'
import type { ShortcutOverrides } from '../types/common/shortcut'
import { useEditorRuntime } from '../runtime/hooks/useEditor'
import { isKeyboardIgnoredTarget } from '../runtime/host/domTargets'
import {
  DefaultShortcutBindings,
  runShortcut
} from './shortcut'
import { resolveKeyboardInput } from '../runtime/host/input'
import { detectShortcutPlatform } from '../runtime/host/keyboardPlatform'

export const useKeyboard = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  const editor = useEditorRuntime()
  const bindings = useMemo(
    () => resolveShortcutBindings(DefaultShortcutBindings, shortcuts),
    [shortcuts]
  )
  const shortcutMap = useMemo(
    () => createShortcutMap(bindings, detectShortcutPlatform()),
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

      const input = resolveKeyboardInput(event)

      if (editor.input.keyDown(input)) {
        if (event.cancelable) {
          event.preventDefault()
        }
        event.stopPropagation()
        return
      }

      if (event.repeat) return

      const action = readShortcut(input, shortcutMap)
      if (!action) return
      if (!runShortcut(editor, action)) return

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
        if (event.code === 'Space' && editor.interaction.state.get().space) {
          editor.input.keyUp(resolveKeyboardInput(event))
        }
        return
      }

      if (!editor.input.keyUp(resolveKeyboardInput(event))) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      editor.input.blur()
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
  }, [containerRef, editor, shortcutMap])
}
