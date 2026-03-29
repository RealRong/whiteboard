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

  useEffect(() => () => {
    editor.input.cancel()
  }, [editor])

  const onPointerDown = useCallback((event: PointerEvent) => {
    const container = containerRef.current
    if (!container) {
      return false
    }

    return editor.input.pointerDown({
      container,
      event
    })
  }, [containerRef, editor])

  const onPointerMove = useCallback((event: PointerEvent) => {
    const container = containerRef.current
    if (!container) {
      return
    }

    editor.input.pointerMove({
      container,
      event
    })
  }, [containerRef, editor])

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
