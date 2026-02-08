import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useInstance } from '../hooks/useInstance'

type CanvasHandlers = {
  handlePointerDown: (event: PointerEvent) => void
  handlePointerDownCapture: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

type Options = {
  containerRef: RefObject<HTMLDivElement | null>
  handlers: CanvasHandlers
  onWheel: (event: WheelEvent) => void
}

export const useCanvasEventBindings = ({ containerRef, handlers, onWheel }: Options) => {
  const instance = useInstance()
  const handlersRef = useRef(handlers)
  const onWheelRef = useRef(onWheel)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    onWheelRef.current = onWheel
  }, [onWheel])

  useEffect(() => {
    if (!containerRef.current) return

    const offPointerDownCapture = instance.addContainerEventListener(
      'pointerdown',
      (event) => handlersRef.current.handlePointerDownCapture(event),
      true
    )
    const offPointerDown = instance.addContainerEventListener(
      'pointerdown',
      (event) => handlersRef.current.handlePointerDown(event)
    )
    const offPointerMove = instance.addContainerEventListener(
      'pointermove',
      (event) => handlersRef.current.handlePointerMove(event)
    )
    const offPointerUp = instance.addContainerEventListener(
      'pointerup',
      (event) => handlersRef.current.handlePointerUp(event)
    )
    const offWheel = instance.addContainerEventListener('wheel', (event) => onWheelRef.current(event), {
      passive: false
    })
    const offKeyDown = instance.addContainerEventListener(
      'keydown',
      (event) => handlersRef.current.handleKeyDown(event)
    )

    return () => {
      offPointerDownCapture()
      offPointerDown()
      offPointerMove()
      offPointerUp()
      offWheel()
      offKeyDown()
    }
  }, [containerRef, instance])
}
