import type { Instance } from '@engine-types/instance'
import { createContextResolver } from './contextResolver'

type Options = {
  instance: Instance
}

export type ShortcutHandlers = {
  handlePointerDownCapture: (event: PointerEvent, onUnhandled?: () => void) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export const createShortcut = ({
  instance
}: Options): ShortcutHandlers => {
  const resolveContext = createContextResolver(instance)

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
