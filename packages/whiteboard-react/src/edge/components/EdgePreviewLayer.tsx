import { useEffect } from 'react'
import { useInternalInstance as useInstance, useWhiteboardSelector } from '../../common/hooks'
import { resolveSnapTarget } from '../interaction/connectMath'
import {
  edgeConnectPreviewState,
  useEdgeConnectPreviewState
} from '../interaction/connectPreviewState'

export const EdgePreviewLayer = () => {
  const instance = useInstance()
  const tool = useWhiteboardSelector('tool')
  const { activePointerId, from, to, snap, showPreviewLine } = useEdgeConnectPreviewState()

  useEffect(() => {
    if (tool !== 'edge') {
      edgeConnectPreviewState.reset(instance)
      return
    }
    if (typeof window === 'undefined') return

    let frameId: number | null = null
    let latestEvent: PointerEvent | null = null

    const flush = () => {
      frameId = null
      if (!latestEvent) return
      if (edgeConnectPreviewState.getSnapshot(instance).activePointerId !== undefined) return

      const screen = instance.runtime.viewport.clientToScreen(
        latestEvent.clientX,
        latestEvent.clientY
      )
      const world = instance.runtime.viewport.screenToWorld(screen)
      const target = resolveSnapTarget(instance, world)
      edgeConnectPreviewState.setHoverSnap(instance, target?.pointWorld)
    }

    const handlePointerMove = (event: PointerEvent) => {
      latestEvent = event
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(flush)
    }

    const clearHover = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
        frameId = null
      }
      edgeConnectPreviewState.clearHoverSnap(instance)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('blur', clearHover)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', clearHover)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [instance, tool])

  if (!from && !to && !snap) return null
  return (
    <svg width="100%" height="100%" className="wb-edge-preview-layer">
      {showPreviewLine && from && to && (
        <>
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="rgba(17,24,39,0.7)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={from.x} cy={from.y} r={4} fill="#111827" className="wb-edge-preview-point" />
          <circle cx={to.x} cy={to.y} r={4} fill="#111827" className="wb-edge-preview-point" />
        </>
      )}
      {snap && (
        <circle
          cx={snap.x}
          cy={snap.y}
          r={6}
          fill="rgba(59,130,246,0.2)"
          stroke="#2563eb"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="wb-edge-preview-point"
          data-active={activePointerId !== undefined ? 'true' : 'false'}
        />
      )}
    </svg>
  )
}
