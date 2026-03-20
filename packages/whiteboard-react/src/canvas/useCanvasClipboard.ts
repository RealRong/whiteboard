import { useEffect, useRef, type RefObject } from 'react'
import { useInternalInstance } from '../runtime/hooks'
import {
  copySelection,
  cutSelection,
  pasteClipboard,
  hasClipboardSelection
} from './actions'
import {
  isEditableTarget,
  isInputIgnoredTarget
} from './target'

export const useCanvasClipboard = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const lastPointerWorldRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const shouldIgnore = (target: EventTarget | null) =>
      isEditableTarget(target) || isInputIgnoredTarget(target)

    const onPointerMove = (event: PointerEvent) => {
      lastPointerWorldRef.current = instance.viewport.pointer(event).world
    }

    const onCopy = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target) || !hasClipboardSelection(instance)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void copySelection(instance, event)
    }

    const onCut = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target) || !hasClipboardSelection(instance)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void cutSelection(instance, event)
    }

    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void pasteClipboard(instance, {
        event,
        at: lastPointerWorldRef.current ?? undefined
      })
    }

    container.addEventListener('pointermove', onPointerMove, true)
    container.addEventListener('copy', onCopy)
    container.addEventListener('cut', onCut)
    container.addEventListener('paste', onPaste)

    return () => {
      container.removeEventListener('pointermove', onPointerMove, true)
      container.removeEventListener('copy', onCopy)
      container.removeEventListener('cut', onCut)
      container.removeEventListener('paste', onPaste)
    }
  }, [containerRef, instance])
}
