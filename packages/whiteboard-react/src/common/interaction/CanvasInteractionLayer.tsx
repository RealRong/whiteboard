import type { Instance } from '@whiteboard/engine'
import type { CSSProperties, ReactNode } from 'react'
import { useSelectionBoxInteraction } from './useSelectionBoxInteraction'
import {
  useViewportGestureInteraction,
  type ViewportPolicy
} from './useViewportGestureInteraction'

type CanvasInteractionLayerProps = {
  instance: Instance
  viewportPolicy: ViewportPolicy
  getContainer: () => HTMLDivElement | null
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export const CanvasInteractionLayer = ({
  instance,
  viewportPolicy,
  getContainer,
  className,
  style,
  children
}: CanvasInteractionLayerProps) => {
  const {
    handleViewportPointerDownCapture,
    handleViewportWheel
  } = useViewportGestureInteraction({
    instance,
    viewportPolicy,
    getContainer
  })

  const { handleViewportPointerDown } = useSelectionBoxInteraction(instance)

  return (
    <div
      className={className}
      style={style}
      onPointerDownCapture={handleViewportPointerDownCapture}
      onPointerDown={handleViewportPointerDown}
      onWheel={handleViewportWheel}
    >
      {children}
    </div>
  )
}
