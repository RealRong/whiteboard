import type { InternalInstance } from '@engine-types/instance/instance'
import { resolveContextFromEvent } from './contextFromEvent'

type Options = {
  instance: InternalInstance
}

export type ShortcutHandlers = {
  handlePointerDownCapture: (event: PointerEvent, onUnhandled?: () => void) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export const createShortcut = ({
  instance
}: Options): ShortcutHandlers => {
  const readBaseContext = () => instance.view.global.shortcutContext()
  const resolveContext = (event: PointerEvent | KeyboardEvent) =>
    resolveContextFromEvent(readBaseContext(), event)

  const handlePointerDownCapture: ShortcutHandlers['handlePointerDownCapture'] = (event, onUnhandled) => {
    const handled = instance.runtime.shortcuts.handlePointerDownCapture(event, resolveContext(event))
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onUnhandled?.()
  }

  const handleKeyDown: ShortcutHandlers['handleKeyDown'] = (event) => {
    const handled = instance.runtime.shortcuts.handleKeyDown(event, resolveContext(event))
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return {
    handlePointerDownCapture,
    handleKeyDown
  }
}
