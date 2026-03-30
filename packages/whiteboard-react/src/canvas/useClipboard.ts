import { useEffect, type RefObject } from 'react'
import {
  isEditableTarget,
  isInputIgnoredTarget
} from '../runtime/host/domTargets'
import { useClipboardActions } from '../runtime/host/useClipboardActions'

export const useClipboard = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const clipboard = useClipboardActions()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const shouldIgnore = (target: EventTarget | null) =>
      isEditableTarget(target) || isInputIgnoredTarget(target)

    const onCopy = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void clipboard.copy('selection', {
        event
      })
    }

    const onCut = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void clipboard.cut('selection', {
        event
      })
    }

    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void clipboard.paste({
        event
      })
    }

    container.addEventListener('copy', onCopy)
    container.addEventListener('cut', onCut)
    container.addEventListener('paste', onPaste)

    return () => {
      container.removeEventListener('copy', onCopy)
      container.removeEventListener('cut', onCut)
      container.removeEventListener('paste', onPaste)
    }
  }, [clipboard, containerRef])
}
