import type { Instance } from '@engine-types/instance'
import { createShortcutContextResolver } from './contextResolver'

type Options = {
  instance: Instance
}

export type ShortcutInputHandlers = {
  handlePointerDownCapture: (event: PointerEvent, onUnhandled?: () => void) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export const createShortcutInputHandlers = ({
  instance
}: Options): ShortcutInputHandlers => {
  const resolveContext = createShortcutContextResolver(instance)

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
