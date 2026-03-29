import {
  useCallback,
  useEffect,
  type RefObject
} from 'react'
import { useEditor } from '../runtime/hooks'

export const usePointer = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const editor = useEditor()

  const refreshContainerRect = useCallback((container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect()
    editor.viewport.setRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    })
  }, [editor])

  useEffect(() => () => {
    editor.input.cancel()
  }, [editor])

  const onPointerDown = useCallback((event: PointerEvent) => {
    if (event.defaultPrevented) {
      return false
    }

    const container = containerRef.current
    if (!container) {
      return false
    }

    refreshContainerRect(container)
    return editor.input.pointerDown({
      container,
      event
    })
  }, [containerRef, editor, refreshContainerRect])

  const onPointerMove = useCallback((event: PointerEvent) => {
    const container = containerRef.current
    if (!container) {
      return
    }

    refreshContainerRect(container)
    editor.input.pointerMove({
      container,
      event
    })
  }, [containerRef, editor, refreshContainerRect])

  const onPointerLeave = useCallback(() => {
    editor.input.pointerLeave()
  }, [editor])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      onPointerDown(event)
    }
    const handlePointerMove = (event: PointerEvent) => {
      onPointerMove(event)
    }
    const handlePointerLeave = () => {
      onPointerLeave()
    }

    container.addEventListener('pointerdown', handlePointerDown, true)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [containerRef, onPointerDown, onPointerLeave, onPointerMove])
}
