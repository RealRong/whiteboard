import { useCallback, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeAnchor, Point, Rect } from '@whiteboard/core'
import { clamp, getAnchorPoint, rotatePoint } from '../../common/utils/geometry'
import { canvasNodesAtom, edgeConnectAtom, edgeSelectionAtom, toolAtom } from '../../common/state'
import { useInstance, useInstanceAtomValue } from '../../common/hooks'
import type {
  EdgeConnectAnchorResult,
  UseEdgeConnectReturn,
  UseEdgeConnectStateReturn
} from 'types/edge'

const getSideCenters = (rect: Rect) => ({
  top: { x: rect.x + rect.width / 2, y: rect.y },
  right: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
  bottom: { x: rect.x + rect.width / 2, y: rect.y + rect.height },
  left: { x: rect.x, y: rect.y + rect.height / 2 }
})

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const getNearestSide = (rect: Rect, point: Point) => {
  const centers = getSideCenters(rect)
  const entries = Object.entries(centers) as Array<[EdgeAnchor['side'], Point]>
  let best = entries[0]
  let bestDistance = distance(point, entries[0][1])
  entries.slice(1).forEach((entry) => {
    const d = distance(point, entry[1])
    if (d < bestDistance) {
      best = entry
      bestDistance = d
    }
  })
  return { side: best[0], center: best[1], distance: bestDistance }
}

const getAnchorFromPoint = (rect: Rect, rotation: number, point: Point): EdgeConnectAnchorResult => {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const localPoint = rotatePoint(point, center, -rotation)
  const nearest = getNearestSide(rect, localPoint)
  const threshold = Math.max(12, Math.min(rect.width, rect.height) * 0.18)
  const useCenter = nearest.distance <= threshold
  let offset = 0.5
  if (!useCenter) {
    if (nearest.side === 'top' || nearest.side === 'bottom') {
      offset = rect.width === 0 ? 0.5 : clamp((localPoint.x - rect.x) / rect.width, 0, 1)
    } else {
      offset = rect.height === 0 ? 0.5 : clamp((localPoint.y - rect.y) / rect.height, 0, 1)
    }
  }
  const anchor: EdgeAnchor = { side: nearest.side, offset }
  return { anchor, point: getAnchorPoint(rect, anchor, rotation) }
}

export const useEdgeConnectState = (): UseEdgeConnectStateReturn => {
  const instance = useInstance()
  const canvasNodes = useInstanceAtomValue(canvasNodesAtom)
  const tool = useInstanceAtomValue(toolAtom)
  const selectedEdgeId = useInstanceAtomValue(edgeSelectionAtom)
  const state = useInstanceAtomValue(edgeConnectAtom)

  const screenToWorld = instance.runtime.viewport.screenToWorld ?? undefined
  const containerRef = instance.runtime.containerRef ?? undefined
  const activeTool = (tool as 'select' | 'edge') ?? 'select'

  const nodeRects = useMemo(() => instance.query.getCanvasNodeRects(), [canvasNodes, instance])

  return useMemo(
    () => ({
      state,
      selectedEdgeId,
      tool: activeTool,
      containerRef,
      screenToWorld,
      nodeRects,
      getAnchorFromPoint
    }),
    [activeTool, containerRef, nodeRects, screenToWorld, selectedEdgeId, state]
  )
}

export const useEdgeConnect = (): UseEdgeConnectReturn => {
  const instance = useInstance()
  const state = useEdgeConnectState()

  const handleNodePointerDown = useCallback(
    (nodeId: string, pointWorld: Point, event: ReactPointerEvent<HTMLElement>) => {
      const handled = instance.commands.edgeConnect.handleNodePointerDown(nodeId, pointWorld, event.pointerId)
      if (!handled) return false
      event.preventDefault()
      event.stopPropagation()
      return true
    },
    [instance]
  )

  return useMemo(
    () => ({
      ...state,
      startFromHandle: instance.commands.edgeConnect.startFromHandle,
      startFromPoint: instance.commands.edgeConnect.startFromPoint,
      startReconnect: instance.commands.edgeConnect.startReconnect,
      updateTo: instance.commands.edgeConnect.updateTo,
      commitTo: instance.commands.edgeConnect.commitTo,
      cancel: instance.commands.edgeConnect.cancel,
      selectEdge: instance.commands.edge.select,
      updateHover: instance.commands.edgeConnect.updateHover,
      handleNodePointerDown
    }),
    [handleNodePointerDown, instance, state]
  )
}

export const edgeConnect = {
  useState: useEdgeConnectState,
  useConnect: useEdgeConnect
}
