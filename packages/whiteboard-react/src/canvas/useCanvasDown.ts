import {
  useCallback,
  useEffect,
  useRef,
  type RefObject
} from 'react'
import { useDrawInput } from '../features/draw/useDrawInput'
import { useEdgeInput } from '../features/edge/hooks/useEdgeInput'
import { useMindmapDrag } from '../features/mindmap/hooks/drag/useMindmapDrag'
import { createNodeGesture } from '../features/node/gesture'
import { createTransformSession } from '../features/node/hooks/transform/session'
import {
  createMarqueeSession
} from '../features/selection/chrome/Marquee'
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
  const nodeRef = useRef<ReturnType<typeof createNodeGesture> | null>(null)
  const transformRef = useRef<ReturnType<typeof createTransformSession> | null>(null)

  if (!marqueeRef.current) {
    marqueeRef.current = createMarqueeSession(instance)
  }

  const marquee = marqueeRef.current!

  if (!nodeRef.current) {
    nodeRef.current = createNodeGesture(instance, marquee)
  }

  const node = nodeRef.current!

  if (!transformRef.current) {
    transformRef.current = createTransformSession(instance)
  }

  const transform = transformRef.current!
  const edge = useEdgeInput({
    containerRef
  })
  const draw = useDrawInput()
  const insert = useInsertDown()
  const mindmap = useMindmapDrag()

  useEffect(() => () => {
    marquee.cancel()
    node.cancel()
    transform.cancel()
  }, [marquee, node, transform])

  const downTool = useCallback((input: CanvasDown) => (
    edge.create(input)
    || draw.down(input)
    || insert.down(input)
  ), [draw, edge, insert])

  const downDirect = useCallback((input: CanvasDown) => (
    transform.down(input)
    || edge.down(input)
    || mindmap.down(input)
  ), [edge, mindmap, transform])

  const downScene = useCallback((input: CanvasDown) => (
    node.down(input)
  ), [node])

  const onPointerDown = useCallback((event: PointerEvent) => {
    const container = containerRef.current
    if (!container) {
      return false
    }

    const input = readCanvasDown(instance, container, event)
    return downTool(input) || downDirect(input) || downScene(input)
  }, [containerRef, downDirect, downScene, downTool, instance])

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
    node,
    drawPreview: draw.preview,
    edgeKeyDown: edge.keyDown
  }
}
