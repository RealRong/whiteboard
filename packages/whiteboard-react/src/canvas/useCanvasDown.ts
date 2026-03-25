import {
  useCallback,
  useEffect,
  useRef,
  type RefObject
} from 'react'
import { useDrawInput } from '../features/draw/useDrawInput'
import { useEraserInput } from '../features/draw/useEraserInput'
import { useEdgeInput } from '../features/edge/hooks/useEdgeInput'
import { useMindmapDrag } from '../features/mindmap/hooks/drag/useMindmapDrag'
import { createNodeGesture } from '../features/node/gesture'
import { createTransformSession } from '../features/node/hooks/transform/session'
import {
  createMarqueeSession
} from '../features/selection/Marquee'
import { useInsertDown } from '../features/toolbox/useInsertDown'
import { useInternalInstance } from '../runtime/hooks'
import {
  readCanvasDown,
  type CanvasDown
} from '../runtime/input/down'

export const useCanvasDown = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const marqueeRef = useRef<ReturnType<typeof createMarqueeSession> | null>(null)
  const gestureRef = useRef<ReturnType<typeof createNodeGesture> | null>(null)
  const transformRef = useRef<ReturnType<typeof createTransformSession> | null>(null)

  const marquee =
    marqueeRef.current
    ?? (marqueeRef.current = createMarqueeSession(instance))
  const gesture =
    gestureRef.current
    ?? (gestureRef.current = createNodeGesture(instance, marquee))
  const transform =
    transformRef.current
    ?? (transformRef.current = createTransformSession(instance))
  const edge = useEdgeInput({
    containerRef
  })
  const eraser = useEraserInput()
  const draw = useDrawInput()
  const insert = useInsertDown()
  const mindmap = useMindmapDrag()

  useEffect(() => () => {
    marquee.cancel()
    gesture.cancel()
    transform.cancel()
  }, [gesture, marquee, transform])

  const handleDown = useCallback((input: CanvasDown) => (
    edge.create(input)
    || eraser.down(input)
    || draw.down(input)
    || insert.down(input)
    || transform.down(input)
    || edge.down(input)
    || mindmap.down(input)
    || gesture.down(input)
  ), [draw, edge, eraser, gesture, insert, mindmap, transform])

  const onPointerDown = useCallback((event: PointerEvent) => {
    const container = containerRef.current
    if (!container) {
      return false
    }

    const input = readCanvasDown(instance, container, event)
    return handleDown(input)
  }, [containerRef, handleDown, instance])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      onPointerDown(event)
    }

    container.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [containerRef, onPointerDown])

  return {
    marquee,
    gesture,
    drawPreview: draw.preview,
    edgePathKeyDown: edge.keyDown
  }
}
