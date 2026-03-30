import { useEffect, type RefObject } from 'react'
import {
  isEditableTarget,
  isInputIgnoredTarget
} from './domTargets'
import { useEditor } from '../runtime/hooks'

export const useClipboard = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const editor = useEditor()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const shouldIgnore = (target: EventTarget | null) =>
      isEditableTarget(target) || isInputIgnoredTarget(target)

    const hasSelectionTarget = () => {
      const selection = editor.read.selection.get()
      return selection.summary.items.count > 0
    }

    const onCopy = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target) || !hasSelectionTarget()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void editor.commands.clipboard.copy('selection', {
        event
      })
    }

    const onCut = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target) || !hasSelectionTarget()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void editor.commands.clipboard.cut('selection', {
        event
      })
    }

    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void editor.commands.clipboard.paste({
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
  }, [containerRef, editor])
}
