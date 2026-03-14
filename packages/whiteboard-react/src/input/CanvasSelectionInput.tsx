import { useEffect, type RefObject } from 'react'
import { useTransientReset } from '../common/hooks'
import { useSelectionBoxInteraction } from '../selection/useSelectionBoxInteraction'

export const CanvasSelectionInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const {
    handleContainerPointerDown,
    cancelSelectionSession
  } = useSelectionBoxInteraction()

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

  useTransientReset(cancelSelectionSession)

  return null
}
