import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Edge, EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { clamp, getAnchorPoint, getNodeAABB, getNodeRect, rotatePoint } from '../../common/utils/geometry'
import { canvasNodesAtom, edgeConnectAtom, edgeSelectionAtom, toolAtom, visibleEdgesAtom } from '../../common/state'
import type { EdgeConnectState } from '../../common/state'
import { useCanvasNodes, useInstance, useWhiteboardConfig } from '../../common/hooks'

type ConnectTo = NonNullable<EdgeConnectState['to']>

type AnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

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

const getAnchorFromPoint = (rect: Rect, rotation: number, point: Point): AnchorResult => {
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

const isSameConnectTo = (left?: EdgeConnectState['hover'], right?: ConnectTo) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return (
    left.nodeId === right.nodeId &&
    left.anchor?.side === right.anchor?.side &&
    left.anchor?.offset === right.anchor?.offset &&
    left.pointWorld?.x === right.pointWorld?.x &&
    left.pointWorld?.y === right.pointWorld?.y
  )
}

export type UseEdgeConnectReturn = {
  state: EdgeConnectState
  selectedEdgeId?: string
  tool: 'select' | 'edge'
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  startFromHandle: (nodeId: string, side: EdgeAnchor['side'], pointerId?: number) => void
  startFromPoint: (nodeId: string, pointWorld: Point, pointerId?: number) => void
  startReconnect: (edgeId: string, end: 'source' | 'target', pointerId?: number) => void
  updateTo: (pointWorld: Point) => void
  commitTo: (pointWorld: Point) => void
  cancel: () => void
  selectEdge: (edgeId?: string) => void
  updateHover: (pointWorld: Point) => void
  handleNodePointerDown: (nodeId: string, pointWorld: Point, event: ReactPointerEvent<HTMLElement>) => boolean
  nodeRects: Array<{ node: Node; rect: Rect; aabb: Rect; rotation: number }>
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => AnchorResult
}

export type UseEdgeConnectStateReturn = Pick<
  UseEdgeConnectReturn,
  'state' | 'selectedEdgeId' | 'tool' | 'containerRef' | 'screenToWorld' | 'nodeRects' | 'getAnchorFromPoint'
>

export const useEdgeConnectState = (): UseEdgeConnectStateReturn => {
  const instance = useInstance()
  const canvasNodes = useCanvasNodes()
  const { nodeSize } = useWhiteboardConfig()
  const tool = useAtomValue(toolAtom)
  const selectedEdgeId = useAtomValue(edgeSelectionAtom)
  const state = useAtomValue(edgeConnectAtom)

  const screenToWorld = instance.viewport.screenToWorld ?? undefined
  const containerRef = instance.containerRef ?? undefined
  const activeTool = (tool as 'select' | 'edge') ?? 'select'

  const nodeRects = useMemo(() => {
    return canvasNodes.map((node) => ({
      node,
      rect: getNodeRect(node, nodeSize),
      aabb: getNodeAABB(node, nodeSize),
      rotation: typeof node.rotation === 'number' ? node.rotation : 0
    }))
  }, [canvasNodes, nodeSize])

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

export type UseEdgeConnectActionsReturn = Pick<
  UseEdgeConnectReturn,
  | 'startFromHandle'
  | 'startFromPoint'
  | 'startReconnect'
  | 'updateTo'
  | 'commitTo'
  | 'cancel'
  | 'selectEdge'
  | 'updateHover'
  | 'handleNodePointerDown'
>

export const useEdgeConnectActions = (): UseEdgeConnectActionsReturn => {
  const instance = useInstance()
  const store = useStore()
  const setState = useSetAtom(edgeConnectAtom)
  const setSelectedEdgeId = useSetAtom(edgeSelectionAtom)
  const getZoom = instance.viewport.getZoom
  const nodeSize = instance.config.nodeSize
  const edgeType: Edge['type'] = 'linear'

  const hoverRafRef = useRef<number | null>(null)
  const hoverPointRef = useRef<Point | null>(null)

  const getNodeRects = useCallback(() => {
    const canvasNodes = store.get(canvasNodesAtom)
    return canvasNodes.map((node) => ({
      node,
      rect: getNodeRect(node, nodeSize),
      aabb: getNodeAABB(node, nodeSize),
      rotation: typeof node.rotation === 'number' ? node.rotation : 0
    }))
  }, [nodeSize.height, nodeSize.width, store])

  const getSnapAtPoint = useCallback(
    (point: Point): ConnectTo | undefined => {
      const snapThresholdWorld =
        Math.max(12, Math.min(nodeSize.width, nodeSize.height) * 0.18) / Math.max(getZoom(), 0.0001)
      const nodeRects = getNodeRects()
      let best: { nodeId: string; anchor: EdgeAnchor; pointWorld: Point; distance: number } | undefined
      for (let i = 0; i < nodeRects.length; i += 1) {
        const entry = nodeRects[i]
        const rect = entry.aabb
        const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
        const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
        const outsideDistance = Math.hypot(dx, dy)
        if (outsideDistance > snapThresholdWorld) continue
        const { anchor, point: anchorPoint } = getAnchorFromPoint(entry.rect, entry.rotation, point)
        const d = Math.hypot(anchorPoint.x - point.x, anchorPoint.y - point.y)
        if (!best || d < best.distance) {
          best = { nodeId: entry.node.id, anchor, pointWorld: anchorPoint, distance: d }
        }
      }
      if (!best) return undefined
      return {
        nodeId: best.nodeId,
        anchor: best.anchor,
        pointWorld: best.pointWorld
      }
    },
    [getNodeRects, getZoom, nodeSize.height, nodeSize.width]
  )

  const flushHover = useCallback(() => {
    hoverRafRef.current = null
    const pointWorld = hoverPointRef.current
    hoverPointRef.current = null
    if (!pointWorld) return

    const activeTool = (store.get(toolAtom) as 'select' | 'edge') ?? 'select'
    if (activeTool !== 'edge') return

    const snap = getSnapAtPoint(pointWorld)
    setState((prev) => {
      if (prev.isConnecting) return prev
      if (!snap) {
        if (!prev.hover) return prev
        return { ...prev, hover: undefined }
      }
      if (isSameConnectTo(prev.hover, snap)) {
        return prev
      }
      return { ...prev, hover: snap }
    })
  }, [getSnapAtPoint, setState, store])

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current)
      }
      hoverRafRef.current = null
      hoverPointRef.current = null
    }
  }, [])

  const startFromHandle = useCallback(
    (nodeId: string, side: EdgeAnchor['side'], pointerId?: number) => {
      const anchor: EdgeAnchor = { side, offset: 0.5 }
      const next: EdgeConnectState = {
        isConnecting: true,
        from: { nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: undefined,
        pointerId: pointerId ?? null
      }
      setState(next)
    },
    [setState]
  )

  const startFromPoint = useCallback(
    (nodeId: string, pointWorld: Point, pointerId?: number) => {
      const entry = getNodeRects().find((item) => item.node.id === nodeId)
      if (!entry) return
      const { anchor } = getAnchorFromPoint(entry.rect, entry.rotation, pointWorld)
      const next: EdgeConnectState = {
        isConnecting: true,
        from: { nodeId, anchor },
        to: { pointWorld },
        hover: undefined,
        reconnect: undefined,
        pointerId: pointerId ?? null
      }
      setState(next)
    },
    [getNodeRects, setState]
  )

  const startReconnect = useCallback(
    (edgeId: string, end: 'source' | 'target', pointerId?: number) => {
      const visibleEdges = store.get(visibleEdgesAtom)
      const edge = visibleEdges.find((item) => item.id === edgeId)
      if (!edge) return
      const endpoint = edge[end]
      const anchor = endpoint.anchor ?? { side: 'right', offset: 0.5 }
      const next: EdgeConnectState = {
        isConnecting: true,
        from: { nodeId: endpoint.nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: { edgeId, end },
        pointerId: pointerId ?? null
      }
      setState(next)
    },
    [setState, store]
  )

  const updateTo = useCallback(
    (pointWorld: Point) => {
      setState((prev) => {
        if (!prev.isConnecting || !prev.from) return prev
        const snap = getSnapAtPoint(pointWorld)
        if (snap) {
          return { ...prev, to: snap }
        }
        return { ...prev, to: { pointWorld } }
      })
    },
    [getSnapAtPoint, setState]
  )

  const commitTo = useCallback(
    (pointWorld: Point) => {
      const currentState = store.get(edgeConnectAtom)
      if (!currentState.isConnecting || !currentState.from) return

      const snap = getSnapAtPoint(pointWorld)
      if (!snap || !snap.nodeId || !snap.anchor) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          from: undefined,
          to: undefined,
          reconnect: undefined,
          pointerId: null
        }))
        return
      }

      if (currentState.reconnect) {
        const visibleEdges = store.get(visibleEdgesAtom)
        const edge = visibleEdges.find((item) => item.id === currentState.reconnect?.edgeId)
        if (edge) {
          instance.core.dispatch({
            type: 'edge.update',
            id: edge.id,
            patch:
              currentState.reconnect.end === 'source'
                ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
                : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
          })
        }
      } else {
        instance.core.dispatch({
          type: 'edge.create',
          payload: {
            source: { nodeId: currentState.from.nodeId, anchor: currentState.from.anchor },
            target: { nodeId: snap.nodeId, anchor: snap.anchor },
            type: edgeType
          }
        })
      }

      setState((prev) => ({
        ...prev,
        isConnecting: false,
        from: undefined,
        to: undefined,
        reconnect: undefined,
        pointerId: null
      }))
    },
    [edgeType, getSnapAtPoint, instance.core, setState, store]
  )

  const cancel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isConnecting: false,
      from: undefined,
      to: undefined,
      reconnect: undefined,
      pointerId: null
    }))
  }, [setState])

  const selectEdge = useCallback(
    (edgeId?: string) => {
      setSelectedEdgeId((prev) => (prev === edgeId ? prev : edgeId))
    },
    [setSelectedEdgeId]
  )

  const updateHover = useCallback(
    (pointWorld: Point) => {
      const activeTool = (store.get(toolAtom) as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'edge') return
      hoverPointRef.current = pointWorld
      if (hoverRafRef.current !== null) return
      if (typeof requestAnimationFrame === 'undefined') {
        flushHover()
        return
      }
      hoverRafRef.current = requestAnimationFrame(flushHover)
    },
    [flushHover, store]
  )

  const handleNodePointerDown = useCallback(
    (nodeId: string, pointWorld: Point, event: ReactPointerEvent<HTMLElement>) => {
      const activeTool = (store.get(toolAtom) as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'edge') return false
      event.preventDefault()
      event.stopPropagation()
      startFromPoint(nodeId, pointWorld, event.pointerId)
      return true
    },
    [startFromPoint, store]
  )

  return useMemo(
    () => ({
      startFromHandle,
      startFromPoint,
      startReconnect,
      updateTo,
      commitTo,
      cancel,
      selectEdge,
      updateHover,
      handleNodePointerDown
    }),
    [cancel, commitTo, handleNodePointerDown, selectEdge, startFromHandle, startFromPoint, startReconnect, updateHover, updateTo]
  )
}

export const useEdgeConnect = (): UseEdgeConnectReturn => {
  const state = useEdgeConnectState()
  const actions = useEdgeConnectActions()

  return useMemo(
    () => ({
      ...state,
      ...actions
    }),
    [actions, state]
  )
}

export const edgeConnect = {
  useState: useEdgeConnectState,
  useActions: useEdgeConnectActions,
  useConnect: useEdgeConnect
}
