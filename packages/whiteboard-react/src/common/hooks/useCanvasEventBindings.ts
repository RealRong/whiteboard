import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useInstance } from './useInstance'

type CanvasHandlers = {
  handlePointerDown: (event: PointerEvent) => void
  handlePointerDownCapture: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

type Options = {
  containerRef: RefObject<HTMLDivElement>
  handlers: CanvasHandlers
  onWheel: (event: WheelEvent) => void
}

export const useCanvasEventBindings = ({ containerRef, handlers, onWheel }: Options) => {
  const instance = useInstance()
  const {
    handlePointerDown,
    handlePointerDownCapture,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown
  } = handlers

  useEffect(() => {
    if (!containerRef.current) return

    const offPointerDownCapture = instance.addContainerEventListener(
      'pointerdown',
      (event) => handlePointerDownCapture(event),
      true
    )
    const offPointerDown = instance.addContainerEventListener('pointerdown', (event) => handlePointerDown(event))
    const offPointerMove = instance.addContainerEventListener('pointermove', (event) => handlePointerMove(event))
    const offPointerUp = instance.addContainerEventListener('pointerup', (event) => handlePointerUp(event))
    const offWheel = instance.addContainerEventListener('wheel', (event) => onWheel(event), { passive: false })
    const offKeyDown = instance.addContainerEventListener('keydown', (event) => handleKeyDown(event))

    return () => {
      offPointerDownCapture()
      offPointerDown()
      offPointerMove()
      offPointerUp()
      offWheel()
      offKeyDown()
    }
  }, [
    containerRef,
    handleKeyDown,
    handlePointerDown,
    handlePointerDownCapture,
    handlePointerMove,
    handlePointerUp,
    instance,
    onWheel
  ])
}
