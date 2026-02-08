import { useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { ShortcutContext } from 'types/shortcuts'
import type { ShortcutManager } from 'types/shortcuts'
import type { InteractionState } from 'types/state'

type Options = {
  shortcutManager: ShortcutManager
  getShortcutContext: () => ShortcutContext
  updateInteraction: (patch: Partial<InteractionState>) => void
}

const isEditableElement = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('input, textarea, select')) return true
  return false
}

export const useShortcutHandlers = ({ shortcutManager, getShortcutContext, updateInteraction }: Options) => {
  const buildEventFocus = useCallback((event?: KeyboardEvent | PointerEvent) => {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    const isEditingTarget = isEditableElement(event?.target ?? null)
    const isInputFocused = isEditableElement(activeElement)
    const isComposing =
      typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent ? event.isComposing : false
    return {
      isEditingText: isEditingTarget,
      isInputFocused,
      isImeComposing: isComposing
    }
  }, [])

  const buildEventModifiers = useCallback(
    (event?: KeyboardEvent | PointerEvent) => {
      const shortcutContext = getShortcutContext()
      if (!event) {
        return shortcutContext.pointer.modifiers
      }
      return {
        alt: event.altKey ?? false,
        shift: event.shiftKey ?? false,
        ctrl: event.ctrlKey ?? false,
        meta: event.metaKey ?? false
      }
    },
    [getShortcutContext]
  )

  const buildShortcutContext = useCallback(
    (event?: KeyboardEvent | PointerEvent) => {
      const shortcutContext = getShortcutContext()
      const focus = buildEventFocus(event)
      const modifiers = buildEventModifiers(event)
      const isPointerEvent = typeof PointerEvent !== 'undefined' && event instanceof PointerEvent
      const pointer = {
        ...shortcutContext.pointer,
        button: isPointerEvent ? (event.button as 0 | 1 | 2) : shortcutContext.pointer.button,
        modifiers
      }
      return {
        ...shortcutContext,
        focus,
        pointer
      }
    },
    [buildEventFocus, buildEventModifiers, getShortcutContext]
  )

  const handlePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement> | PointerEvent, onUnhandled?: () => void) => {
      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
      const ctx = buildShortcutContext(nativeEvent)
      updateInteraction({
        focus: ctx.focus,
        pointer: {
          isDragging: ctx.pointer.isDragging,
          button: ctx.pointer.button,
          modifiers: ctx.pointer.modifiers
        }
      })
      const handled = shortcutManager.handlePointerDown(nativeEvent, ctx)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      onUnhandled?.()
    },
    [buildShortcutContext, shortcutManager, updateInteraction]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement> | KeyboardEvent) => {
      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
      const ctx = buildShortcutContext(nativeEvent)
      updateInteraction({
        focus: ctx.focus,
        pointer: {
          isDragging: ctx.pointer.isDragging,
          button: ctx.pointer.button,
          modifiers: ctx.pointer.modifiers
        }
      })
      const handled = shortcutManager.handleKeyDown(nativeEvent, ctx)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [buildShortcutContext, shortcutManager, updateInteraction]
  )

  return { handlePointerDownCapture, handleKeyDown }
}
