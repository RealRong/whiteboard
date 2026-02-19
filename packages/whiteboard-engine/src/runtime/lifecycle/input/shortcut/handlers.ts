import type { LifecycleContext } from '../../../../context'
import { resolveContextFromEvent } from './contextFromEvent'

type Options = {
  context: LifecycleContext
}

export type ShortcutHandlers = {
  handlePointerDownCapture: (event: PointerEvent, onUnhandled?: () => void) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export const createShortcut = ({
  context
}: Options): ShortcutHandlers => {
  const readBaseContext = () => context.view.global.shortcutContext()
  const resolveContext = (event: PointerEvent | KeyboardEvent) =>
    resolveContextFromEvent(readBaseContext(), event)

  const handlePointerDownCapture: ShortcutHandlers['handlePointerDownCapture'] = (event, onUnhandled) => {
    const handled = context.runtime.shortcuts.handlePointerDownCapture(event, resolveContext(event))
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onUnhandled?.()
  }

  const handleKeyDown: ShortcutHandlers['handleKeyDown'] = (event) => {
    const handled = context.runtime.shortcuts.handleKeyDown(event, resolveContext(event))
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
