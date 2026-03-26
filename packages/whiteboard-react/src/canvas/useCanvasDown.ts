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
import { createSelectionGesture } from '../features/selection/gesture'
import { createTransformSession } from '../features/node/hooks/transform/session'
import {
  createMarqueeSession
} from '../features/selection/Marquee'
import { useInsertDown } from '../features/toolbox/useInsertDown'
import { useInternalInstance } from '../runtime/hooks'
import {
  readCanvasDown,
  readCanvasDownRoute,
  type CanvasDown,
  withCanvasFrame
} from '../runtime/input/pointer'

export const useCanvasDown = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const marqueeRef = useRef<ReturnType<typeof createMarqueeSession> | null>(null)
  const gestureRef = useRef<ReturnType<typeof createSelectionGesture> | null>(null)
  const transformRef = useRef<ReturnType<typeof createTransformSession> | null>(null)

  const marquee =
    marqueeRef.current
    ?? (marqueeRef.current = createMarqueeSession(instance))
  const gesture =
    gestureRef.current
    ?? (gestureRef.current = createSelectionGesture(instance, marquee))
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

  const handleDown = useCallback((input: CanvasDown) => {
    const next = withCanvasFrame(instance, input)
    const route = readCanvasDownRoute(
      next,
      instance.interaction.busy.get()
    )
    if (!route) {
      return false
    }

    switch (route.kind) {
      case 'edge-create':
        return edge.create(route.input)
      case 'eraser':
        return eraser.down(route.input)
      case 'draw':
        return draw.down(route.input)
      case 'insert':
        return insert.down(route.input)
      case 'transform':
        return transform.down(route.input)
      case 'edge':
        return edge.down(route.input)
      case 'mindmap':
        return mindmap.down(route.input)
      case 'gesture':
        return gesture.down(route.input)
    }
  }, [draw, edge, eraser, gesture, insert, instance, mindmap, transform])

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
    edgeRouteKeyDown: edge.keyDown
  }
}
