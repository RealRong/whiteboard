import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Core, Edge, EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { clamp, getAnchorPoint, getNodeAABB, getNodeRect, isPointInRotatedRect, rotatePoint } from '../../common/utils/geometry'

type ConnectFrom = {
  nodeId: string
  anchor: EdgeAnchor
}

type ConnectTo = {
  nodeId?: string
  anchor?: EdgeAnchor
  pointWorld?: Point
}

type ReconnectInfo = {
  edgeId: string
  end: 'source' | 'target'
}

export type EdgeConnectState = {
  isConnecting: boolean
  from?: ConnectFrom
  to?: ConnectTo
  hover?: ConnectTo
  reconnect?: ReconnectInfo
  selectedEdgeId?: string
}

type Options = {
  core: Core
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  zoom?: number
  screenToWorld?: (point: Point) => Point
  containerRef?: RefObject<HTMLElement>
  tool?: 'select' | 'edge'
  edgeType?: Edge['type']
}

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

export type UseEdgeConnectReturn = {
  state: EdgeConnectState
  tool: 'select' | 'edge'
  containerRef?: RefObject<HTMLElement>
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

export const useEdgeConnect = ({
  core,
  nodes,
  edges,
  nodeSize,
  zoom = 1,
  screenToWorld,
  containerRef,
  tool = 'select',
  edgeType = 'linear'
}: Options): UseEdgeConnectReturn => {
  const [state, setState] = useState<EdgeConnectState>({ isConnecting: false })
  const pointerIdRef = useRef<number | null>(null)
  const snapThresholdWorld = Math.max(12, Math.min(nodeSize.width, nodeSize.height) * 0.18) / Math.max(zoom, 0.0001)

  const nodeRects = useMemo(() => {
    return nodes.map((node) => ({
      node,
      rect: getNodeRect(node, nodeSize),
      aabb: getNodeAABB(node, nodeSize),
      rotation: typeof node.rotation === 'number' ? node.rotation : 0
    }))
  }, [nodes, nodeSize])

  const getNodeAtPoint = useCallback(
    (point: Point) => {
      for (let i = nodeRects.length - 1; i >= 0; i -= 1) {
        const entry = nodeRects[i]
        if (isPointInRotatedRect(point, entry.rect, entry.rotation)) {
          return entry
        }
      }
      return undefined
    },
    [nodeRects]
  )

  const getSnapAtPoint = useCallback(
    (point: Point): ConnectTo | undefined => {
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
    [getAnchorFromPoint, nodeRects, snapThresholdWorld]
  )

  const startFromHandle = useCallback((nodeId: string, side: EdgeAnchor['side'], pointerId?: number) => {
    const anchor: EdgeAnchor = { side, offset: 0.5 }
    pointerIdRef.current = pointerId ?? null
    setState({ isConnecting: true, from: { nodeId, anchor } })
  }, [])

  const startFromPoint = useCallback(
    (nodeId: string, pointWorld: Point, pointerId?: number) => {
      const entry = nodeRects.find((item) => item.node.id === nodeId)
      if (!entry) return
      const { anchor } = getAnchorFromPoint(entry.rect, entry.rotation, pointWorld)
      pointerIdRef.current = pointerId ?? null
      setState({ isConnecting: true, from: { nodeId, anchor }, to: { pointWorld } })
    },
    [nodeRects]
  )

  const startReconnect = useCallback(
    (edgeId: string, end: 'source' | 'target', pointerId?: number) => {
      const edge = edges.find((item) => item.id === edgeId)
      if (!edge) return
      const endpoint = edge[end]
      const anchor = endpoint.anchor ?? { side: 'right', offset: 0.5 }
      pointerIdRef.current = pointerId ?? null
      setState({ isConnecting: true, from: { nodeId: endpoint.nodeId, anchor }, reconnect: { edgeId, end } })
    },
    [edges]
  )

  const updateTo = useCallback(
    (pointWorld: Point) => {
      if (!state.isConnecting || !state.from) return
      const snap = getSnapAtPoint(pointWorld)
      if (snap) {
        setState((prev) => ({
          ...prev,
          to: snap
        }))
        return
      }
      setState((prev) => ({
        ...prev,
        to: { pointWorld }
      }))
    },
    [getSnapAtPoint, state.from, state.isConnecting]
  )

  const commitTo = useCallback(
    (pointWorld: Point) => {
      if (!state.isConnecting || !state.from) return
      const snap = getSnapAtPoint(pointWorld)
      if (!snap || !snap.nodeId || !snap.anchor) {
        setState((prev) => ({ ...prev, isConnecting: false, from: undefined, to: undefined, reconnect: undefined }))
        return
      }
      if (state.reconnect) {
        const edge = edges.find((item) => item.id === state.reconnect?.edgeId)
        if (edge) {
          core.dispatch({
            type: 'edge.update',
            id: edge.id,
            patch:
              state.reconnect.end === 'source'
                ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
                : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
          })
        }
      } else {
        core.dispatch({
          type: 'edge.create',
          payload: {
            source: { nodeId: state.from.nodeId, anchor: state.from.anchor },
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
        reconnect: undefined
      }))
    },
    [core, edgeType, edges, getSnapAtPoint, state.from, state.isConnecting, state.reconnect]
  )

  const cancel = useCallback(() => {
    setState((prev) => ({ ...prev, isConnecting: false, from: undefined, to: undefined, reconnect: undefined }))
  }, [])

  const selectEdge = useCallback((edgeId?: string) => {
    setState((prev) => ({ ...prev, selectedEdgeId: edgeId }))
  }, [])

  const updateHover = useCallback(
    (pointWorld: Point) => {
      if (state.isConnecting || tool !== 'edge') return
      const snap = getSnapAtPoint(pointWorld)
      if (!snap) {
        setState((prev) => ({ ...prev, hover: undefined }))
        return
      }
      setState((prev) => ({ ...prev, hover: snap }))
    },
    [getSnapAtPoint, state.isConnecting, tool]
  )

  useEffect(() => {
    if (!state.isConnecting) return
    const handlePointerMove = (event: PointerEvent) => {
      if (!screenToWorld || !containerRef?.current) return
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      updateTo(screenToWorld(point))
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (!screenToWorld || !containerRef?.current) return
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      commitTo(screenToWorld(point))
      pointerIdRef.current = null
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [commitTo, containerRef, screenToWorld, state.isConnecting, updateTo])

  const handleNodePointerDown = useCallback(
    (nodeId: string, pointWorld: Point, event: ReactPointerEvent<HTMLElement>) => {
      if (tool !== 'edge') return false
      event.preventDefault()
      event.stopPropagation()
      startFromPoint(nodeId, pointWorld, event.pointerId)
      return true
    },
    [startFromPoint, tool]
  )

  return {
    state,
    tool,
    containerRef,
    screenToWorld,
    startFromHandle,
    startFromPoint,
    startReconnect,
    updateTo,
    commitTo,
    cancel,
    selectEdge,
    updateHover,
    handleNodePointerDown,
    nodeRects,
    getAnchorFromPoint
  }
}
