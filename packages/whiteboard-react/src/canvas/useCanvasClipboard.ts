import { useEffect, useRef, type RefObject } from 'react'
import { useInternalInstance } from '../runtime/hooks'
import {
  copy,
  cut,
  paste
} from '../features/selection/actions/clipboard'
import {
  isEditableTarget,
  isInputIgnoredTarget
} from '../runtime/input/target'

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

    const hasSelectionTarget = () => {
      const selection = instance.read.selection.get()
      return (
        selection.target.edgeId !== undefined
        || selection.target.nodeIds.length > 0
      )
    }

    const onPointerMove = (event: PointerEvent) => {
      lastPointerWorldRef.current = instance.viewport.pointer(event).world
    }

    const onCopy = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target) || !hasSelectionTarget()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void copy(instance, 'selection', event)
    }

    const onCut = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target) || !hasSelectionTarget()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void cut(instance, 'selection', event)
    }

    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || shouldIgnore(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void paste(instance, {
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
