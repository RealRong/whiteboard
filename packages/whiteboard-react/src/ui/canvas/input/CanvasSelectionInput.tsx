import { useEffect, type RefObject } from 'react'
import { useSelectionBoxInteraction } from './useSelectionBoxInteraction'

export const CanvasSelectionInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const { handleContainerPointerDown } = useSelectionBoxInteraction()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onPointerDown = (event: PointerEvent) => {
      handleContainerPointerDown(event, container)
    }

    container.addEventListener('pointerdown', onPointerDown)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
    }
  }, [containerRef, handleContainerPointerDown])
  return null
}
