import { useCallback, useRef } from 'react'
import { useInstance } from '../useInstance'

type ClientPoint = {
  x: number
  y: number
}

type Options = {
  enabled: boolean
}

export const useEdgeHoverHandlers = ({ enabled }: Options) => {
  const instance = useInstance()
  const edgeHoverPointRef = useRef<ClientPoint | null>(null)
  const edgeHoverRafRef = useRef<number | null>(null)

  const flushEdgeHover = useCallback(() => {
    edgeHoverRafRef.current = null
    const point = edgeHoverPointRef.current as ClientPoint | null
    if (!point) return
    edgeHoverPointRef.current = null
    instance.commands.edgeConnect.updateHover(
      instance.runtime.viewport.screenToWorld(instance.runtime.viewport.clientToScreen(point.x, point.y))
    )
  }, [instance])

  const cancel = useCallback(() => {
    if (edgeHoverRafRef.current !== null) {
      cancelAnimationFrame(edgeHoverRafRef.current)
      edgeHoverRafRef.current = null
    }
    edgeHoverPointRef.current = null
  }, [])

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!enabled) {
        cancel()
        return
      }
      edgeHoverPointRef.current = { x: event.clientX, y: event.clientY }
      if (edgeHoverRafRef.current === null) {
        edgeHoverRafRef.current = requestAnimationFrame(flushEdgeHover)
      }
    },
    [cancel, enabled, flushEdgeHover]
  )

  return {
    onPointerMove,
    cancel
  }
}
