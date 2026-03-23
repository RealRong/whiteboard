import { useEffect, type RefObject } from 'react'

type PointerDownHandler = (
  container: HTMLDivElement,
  event: PointerEvent
) => boolean | void

export const useCanvasPointerDown = ({
  containerRef,
  onPointerDown
}: {
  containerRef: RefObject<HTMLDivElement | null>
  onPointerDown: PointerDownHandler
}) => {
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      onPointerDown(container, event)
    }

    container.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [containerRef, onPointerDown])
}
