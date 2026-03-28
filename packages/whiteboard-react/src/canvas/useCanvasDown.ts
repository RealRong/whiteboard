import {
  useCallback,
  useEffect,
  type RefObject
} from 'react'
import { type MarqueeSession } from '../features/selection/Marquee'
import { useInternalInstance } from '../runtime/hooks'
import {
  handlePointerDown
} from '../runtime/input/pointer'

export const useCanvasDown = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const marquee: MarqueeSession = instance.host.selection.marquee
  const gesture = instance.host.selection.gesture
  const transform = instance.host.node.transform
  const draw = instance.host.draw
  const edgeInput = instance.host.edge.input

  useEffect(() => () => {
    draw.cancel()
    edgeInput.cancel()
    marquee.cancel()
    gesture.cancel()
    transform.cancel()
  }, [draw, edgeInput, gesture, marquee, transform])

  const onPointerDown = useCallback((event: PointerEvent) => {
    const container = containerRef.current
    if (!container) {
      return false
    }

    return handlePointerDown(instance, container, event)
  }, [containerRef, instance])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      onPointerDown(event)
    }
    const handlePointerMove = (event: PointerEvent) => {
      edgeInput.pointerMove(event)
    }
    const handlePointerLeave = () => {
      edgeInput.pointerLeave()
    }

    container.addEventListener('pointerdown', handlePointerDown, true)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [containerRef, edgeInput, onPointerDown])

  return {
    marquee
  }
}
