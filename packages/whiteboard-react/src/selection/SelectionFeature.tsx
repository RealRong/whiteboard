import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { InternalWhiteboardInstance } from '../common/instance'
import { uiSignals } from '../common/instance/uiSignals'
import { useTool } from '../common/hooks/useTool'
import { useSelectionBoxInteraction } from './useSelectionBoxInteraction'

export const SelectionFeature = ({
  instance,
  containerRef
}: {
  instance: InternalWhiteboardInstance
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const tool = useTool()
  const {
    rect,
    handleContainerPointerDown,
    cancelSelectionSession
  } = useSelectionBoxInteraction(instance)

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

  useEffect(() => {
    const unsubscribe = uiSignals.transientReset.subscribe(
      instance.uiStore,
      cancelSelectionSession
    )

    return () => {
      unsubscribe()
      cancelSelectionSession()
    }
  }, [instance.uiStore, cancelSelectionSession])

  if (!rect || tool === 'edge') return null

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
