import type { WhiteboardInstance } from '@engine-types/instance'
import { resolveShortcutContextFromEvent } from './resolveShortcutContextFromEvent'

type CreateShortcutInputHandlersOptions = {
  instance: WhiteboardInstance
}

export type ShortcutInputHandlers = {
  handlePointerDownCapture: (event: PointerEvent, onUnhandled?: () => void) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export const createShortcutInputHandlers = ({
  instance
}: CreateShortcutInputHandlersOptions): ShortcutInputHandlers => {
  const resolveContext = (event: KeyboardEvent | PointerEvent) =>
    resolveShortcutContextFromEvent(instance.view.read('shortcut.context'), event)

  const handlePointerDownCapture: ShortcutInputHandlers['handlePointerDownCapture'] = (event, onUnhandled) => {
    const handled = instance.runtime.shortcuts.handlePointerDownCapture(event, resolveContext(event))
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onUnhandled?.()
  }

  const handleKeyDown: ShortcutInputHandlers['handleKeyDown'] = (event) => {
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
