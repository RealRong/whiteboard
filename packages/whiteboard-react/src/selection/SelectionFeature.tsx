import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { InternalWhiteboardInstance } from '../common/instance'
import { useTransientReset } from '../common/hooks'
import { type Transient } from '../transient'
import { useSelectionBoxInteraction } from './useSelectionBoxInteraction'
import { useSelectionBoxView } from './useSelectionBoxView'

export const SelectionFeature = ({
  instance,
  containerRef,
  selection
}: {
  instance: InternalWhiteboardInstance
  containerRef: RefObject<HTMLDivElement | null>
  selection: Transient['selection']
}) => {
  const rect = useSelectionBoxView(selection)
  const {
    handleContainerPointerDown,
    cancelSelectionSession
  } = useSelectionBoxInteraction(instance, selection)

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

  if (!rect) return null

  return (
    <div
      className="wb-selection-layer"
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height
      }}
    />
  )
}
