import { useEffect, useRef } from 'react'

type UseWindowPointerSessionOptions = {
  pointerId: number | null
  onPointerMove?: (event: PointerEvent) => void
  onPointerUp?: (event: PointerEvent) => void
  onPointerCancel?: (event: PointerEvent) => void
  onBlur?: () => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
}

export const useWindowPointerSession = ({
  pointerId,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onBlur,
  onKeyDown,
  onKeyUp
}: UseWindowPointerSessionOptions) => {
  const handlersRef = useRef({
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onBlur,
    onKeyDown,
    onKeyUp
  })

  handlersRef.current = {
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onBlur,
    onKeyDown,
    onKeyUp
  }

  useEffect(() => {
    if (pointerId === null || typeof window === 'undefined') return undefined

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      handlersRef.current.onPointerMove?.(event)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      handlersRef.current.onPointerUp?.(event)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      handlersRef.current.onPointerCancel?.(event)
    }

    const handleBlur = () => {
      handlersRef.current.onBlur?.()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      handlersRef.current.onKeyDown?.(event)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      handlersRef.current.onKeyUp?.(event)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [pointerId])
}
