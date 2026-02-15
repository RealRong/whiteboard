import type { ShortcutContext, ShortcutNativeEvent } from '@engine-types/shortcuts'

const isEditableElement = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('input, textarea, select')) return true
  return false
}

export const resolveShortcutContextFromEvent = (
  baseContext: ShortcutContext,
  event?: ShortcutNativeEvent
): ShortcutContext => {
  if (!event) return baseContext

  const activeElement = typeof document !== 'undefined' ? document.activeElement : null
  const isEditingTarget = isEditableElement(event.target ?? null)
  const isInputFocused = isEditableElement(activeElement)
  const isImeComposing =
    typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent ? event.isComposing : false

  const modifiers = {
    alt: event.altKey ?? false,
    shift: event.shiftKey ?? false,
    ctrl: event.ctrlKey ?? false,
    meta: event.metaKey ?? false
  }

  const button =
    typeof PointerEvent !== 'undefined' && event instanceof PointerEvent
      ? (event.button as 0 | 1 | 2)
      : baseContext.pointer.button

  return {
    ...baseContext,
    focus: {
      isEditingText: isEditingTarget,
      isInputFocused,
      isImeComposing
    },
    pointer: {
      ...baseContext.pointer,
      button,
      modifiers
    }
  }
}
