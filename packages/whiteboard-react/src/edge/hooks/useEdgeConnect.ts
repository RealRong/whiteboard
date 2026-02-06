import { useCallback, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Edge, EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { clamp, getAnchorPoint, getNodeAABB, getNodeRect, rotatePoint } from '../../common/utils/geometry'
import { viewGraphAtom } from '../../common/state/whiteboardDerivedAtoms'
import { edgeConnectAtom, selectionAtom, viewportAtom } from '../../common/state/whiteboardAtoms'
import type { EdgeConnectState } from '../../common/state/whiteboardAtoms'
import { useInstance, useWhiteboardConfig } from '../../common/hooks'

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

export type UseEdgeConnectReturn = {
  state: EdgeConnectState
  selectedEdgeId?: string
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

export const useEdgeConnect = (): UseEdgeConnectReturn => {
  const instance = useInstance()
  const viewGraph = useAtomValue(viewGraphAtom)
  const { nodeSize } = useWhiteboardConfig()
  const viewport = useAtomValue(viewportAtom)
  const screenToWorld = instance.viewport.screenToWorld ?? undefined
  const containerRef = instance.containerRef ?? undefined
  const selectionState = useAtomValue(selectionAtom)
  const [state, setState] = useAtom(edgeConnectAtom)
  const setSelection = useSetAtom(selectionAtom)

  const tool = (selectionState.tool as 'select' | 'edge') ?? 'select'
  const selectedEdgeId = selectionState.selectedEdgeId
  const zoom = viewport.zoom
  const edgeType: Edge['type'] = 'linear'
  const snapThresholdWorld = Math.max(12, Math.min(nodeSize.width, nodeSize.height) * 0.18) / Math.max(zoom, 0.0001)

  const nodeRects = useMemo(() => {
    return viewGraph.canvasNodes.map((node) => ({
      node,
      rect: getNodeRect(node, nodeSize),
      aabb: getNodeAABB(node, nodeSize),
      rotation: typeof node.rotation === 'number' ? node.rotation : 0
    }))
  }, [nodeSize, viewGraph.canvasNodes])

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
    [nodeRects, snapThresholdWorld]
  )

  const startFromHandle = useCallback((nodeId: string, side: EdgeAnchor['side'], pointerId?: number) => {
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
  }, [setState])

  const startFromPoint = useCallback(
    (nodeId: string, pointWorld: Point, pointerId?: number) => {
      const entry = nodeRects.find((item) => item.node.id === nodeId)
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
    [nodeRects, setState]
  )

  const startReconnect = useCallback(
    (edgeId: string, end: 'source' | 'target', pointerId?: number) => {
      const edge = viewGraph.visibleEdges.find((item) => item.id === edgeId)
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
    [setState, viewGraph.visibleEdges]
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
      if (!state.isConnecting || !state.from) return
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
      if (!instance.core) {
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
      if (state.reconnect) {
        const edge = viewGraph.visibleEdges.find((item) => item.id === state.reconnect?.edgeId)
        if (edge) {
          instance.core.dispatch({
            type: 'edge.update',
            id: edge.id,
            patch:
              state.reconnect.end === 'source'
                ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
                : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
          })
        }
      } else {
        instance.core.dispatch({
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
        reconnect: undefined,
        pointerId: null
      }))
    },
    [edgeType, getSnapAtPoint, instance.core, setState, state.from, state.isConnecting, state.reconnect, viewGraph.visibleEdges]
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

  const selectEdge = useCallback((edgeId?: string) => {
    setSelection((prev) => {
      if (prev.selectedEdgeId === edgeId) return prev
      return { ...prev, selectedEdgeId: edgeId }
    })
  }, [setSelection])

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
    [getSnapAtPoint, setState, state.isConnecting, tool]
  )

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
    selectedEdgeId,
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
