import {
  useCallback,
  useEffect,
  type RefObject
} from 'react'
import { useDrawInput } from '../features/draw/useDrawInput'
import { useEraserInput } from '../features/draw/useEraserInput'
import { useEdgeInput } from '../features/edge/hooks/useEdgeInput'
import { useMindmapDrag } from '../features/mindmap/hooks/drag/useMindmapDrag'
import { type MarqueeSession } from '../features/selection/Marquee'
import { useInsertDown } from '../features/toolbox/useInsertDown'
import { useInternalInstance } from '../runtime/hooks'
import {
  dispatchCanvasDown,
  readCanvasDown,
  type CanvasDown
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
    return dispatchCanvasDown(
      instance,
      input,
      {
        edgeCreate: edge.create,
        eraser: eraser.down,
        draw: draw.down,
        insert: insert.down,
        transform: transform.down,
        edge: edge.down,
        mindmap: mindmap.down,
        gesture: gesture.down
      }
    )
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
    drawPreview: draw.preview,
    edgeRouteKeyDown: edge.keyDown
  }
}
