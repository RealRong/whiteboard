import { useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { ShortcutContext, ShortcutManager } from 'types/shortcuts'
import type { InteractionState } from 'types/state'

type ShortcutNativeEvent = KeyboardEvent | PointerEvent

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

const assembleShortcutContext = (
  getShortcutContext: () => ShortcutContext,
  event?: ShortcutNativeEvent
): ShortcutContext => {
  const shortcutContext = getShortcutContext()
  const activeElement = typeof document !== 'undefined' ? document.activeElement : null
  const isEditingTarget = isEditableElement(event?.target ?? null)
  const isInputFocused = isEditableElement(activeElement)
  const isImeComposing =
    typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent ? event.isComposing : false

  const modifiers = event
    ? {
        alt: event.altKey ?? false,
        shift: event.shiftKey ?? false,
        ctrl: event.ctrlKey ?? false,
        meta: event.metaKey ?? false
      }
    : shortcutContext.pointer.modifiers

  const pointer = {
    ...shortcutContext.pointer,
    button:
      typeof PointerEvent !== 'undefined' && event instanceof PointerEvent
        ? (event.button as 0 | 1 | 2)
        : shortcutContext.pointer.button,
    modifiers
  }

  return {
    ...shortcutContext,
    focus: {
      isEditingText: isEditingTarget,
      isInputFocused,
      isImeComposing
    },
    pointer
  }
}

const dispatchShortcut = ({
  mode,
  shortcutManager,
  event,
  context
}: {
  mode: 'pointer' | 'key'
  shortcutManager: ShortcutManager
  event: ShortcutNativeEvent
  context: ShortcutContext
}) => {
  if (mode === 'pointer') {
    return shortcutManager.handlePointerDown(event as PointerEvent, context)
  }
  return shortcutManager.handleKeyDown(event as KeyboardEvent, context)
}

export const useShortcutHandlers = ({ shortcutManager, getShortcutContext, updateInteraction }: Options) => {
  const applyInteractionSnapshot = useCallback(
    (ctx: ShortcutContext) => {
      updateInteraction({
        focus: ctx.focus,
        pointer: {
          isDragging: ctx.pointer.isDragging,
          button: ctx.pointer.button,
          modifiers: ctx.pointer.modifiers
        }
      })
    },
    [updateInteraction]
  )

  const buildShortcutContext = useCallback(
    (event?: ShortcutNativeEvent) => assembleShortcutContext(getShortcutContext, event),
    [getShortcutContext]
  )

  const runShortcutDispatch = useCallback(
    (mode: 'pointer' | 'key', event: ShortcutNativeEvent, context: ShortcutContext) => {
      return dispatchShortcut({
        mode,
        shortcutManager,
        event,
        context
      })
    },
    [shortcutManager]
  )

  const handlePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement> | PointerEvent, onUnhandled?: () => void) => {
      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
      const ctx = buildShortcutContext(nativeEvent)
      applyInteractionSnapshot(ctx)
      const handled = runShortcutDispatch('pointer', nativeEvent, ctx)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      onUnhandled?.()
    },
    [applyInteractionSnapshot, buildShortcutContext, runShortcutDispatch]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement> | KeyboardEvent) => {
      const nativeEvent = 'nativeEvent' in event ? event.nativeEvent : event
      const ctx = buildShortcutContext(nativeEvent)
      applyInteractionSnapshot(ctx)
      const handled = runShortcutDispatch('key', nativeEvent, ctx)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [applyInteractionSnapshot, buildShortcutContext, runShortcutDispatch]
  )

  return { handlePointerDownCapture, handleKeyDown }
}
