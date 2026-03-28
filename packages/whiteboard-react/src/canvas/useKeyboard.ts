import { useEffect, useMemo, type RefObject } from 'react'
import {
  createShortcutMap,
  readShortcut,
  resolveShortcutBindings
} from '@whiteboard/editor'
import type { ShortcutOverrides } from '../types/common/shortcut'
import { useEditor } from '../runtime/hooks'
import { isKeyboardIgnoredTarget } from './domTargets'
import {
  DefaultShortcutBindings,
  runShortcut
} from './shortcut'

export const useKeyboard = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  const editor = useEditor()
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

      if (editor.commands.input.keyDown({ event })) {
        if (event.cancelable) {
          event.preventDefault()
        }
        event.stopPropagation()
        return
      }

      if (event.repeat) return

      const action = readShortcut(event, shortcutMap)
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
        if (event.code === 'Space' && editor.host.interaction.space.get()) {
          editor.commands.input.keyUp({ event })
        }
        return
      }

      if (!editor.commands.input.keyUp({ event })) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      editor.commands.input.blur()
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
