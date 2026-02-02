import type { Edge, EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import { getEdgePath } from '@whiteboard/core'
import type { MouseEvent, PointerEvent, RefObject } from 'react'
import { useCallback, useMemo, useState } from 'react'
import type { EdgeConnectState } from '../hooks/useEdgeConnect'
import type { Size } from '../types'
import { distancePointToSegment, getAnchorPoint, getNodeRect, getRectCenter } from '../utils/geometry'

type EdgeLayerProps = {
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  zoom?: number
  containerRef?: RefObject<HTMLElement>
  screenToWorld?: (point: Point) => Point
  hitTestThresholdScreen?: number
  selectedEdgeId?: string
  onSelectEdge?: (id?: string) => void
  onInsertPoint?: (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => void
  connectState?: EdgeConnectState
}

export const EdgeLayer = ({
  nodes,
  edges,
  nodeSize,
  zoom = 1,
  containerRef,
  screenToWorld,
  hitTestThresholdScreen = 10,
  selectedEdgeId,
  onSelectEdge,
  onInsertPoint,
  connectState
}: EdgeLayerProps) => {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | undefined>(undefined)
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const paths = useMemo(() => {
    const getAutoAnchor = (rect: Rect, rotation: number, otherCenter: Point) => {
      const center = getRectCenter(rect)
      const dx = otherCenter.x - center.x
      const dy = otherCenter.y - center.y
      const side: EdgeAnchor['side'] =
        Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
      const anchor = { side, offset: 0.5 }
      const point = getAnchorPoint(rect, anchor, rotation)
      return { anchor, point }
    }

    const getReconnectPoint = (
      to?: EdgeConnectState['to']
    ): { point: Point; side?: EdgeAnchor['side'] } | undefined => {
      if (!to) return undefined
      if (to.pointWorld) return { point: to.pointWorld, side: to.anchor?.side }
      if (to.nodeId && to.anchor) {
        const node = nodeMap.get(to.nodeId)
        if (!node) return undefined
        const rect = getNodeRect(node, nodeSize)
        const rotation = typeof node.rotation === 'number' ? node.rotation : 0
        return { point: getAnchorPoint(rect, to.anchor, rotation), side: to.anchor.side }
      }
      return undefined
    }

    return edges
      .map((edge) => {
        const source = nodeMap.get(edge.source.nodeId)
        const target = nodeMap.get(edge.target.nodeId)
        if (!source || !target) return null
        const sourceRect = getNodeRect(source, nodeSize)
        const targetRect = getNodeRect(target, nodeSize)
        const sourceRotation = typeof source.rotation === 'number' ? source.rotation : 0
        const targetRotation = typeof target.rotation === 'number' ? target.rotation : 0
        const sourceCenter = getRectCenter(sourceRect)
        const targetCenter = getRectCenter(targetRect)
        const sourceAnchor = edge.source.anchor ?? getAutoAnchor(sourceRect, sourceRotation, targetCenter).anchor
        const targetAnchor = edge.target.anchor ?? getAutoAnchor(targetRect, targetRotation, sourceCenter).anchor
        const sourcePoint = getAnchorPoint(sourceRect, sourceAnchor, sourceRotation)
        const targetPoint = getAnchorPoint(targetRect, targetAnchor, targetRotation)

        let sourceEndpoint = { point: sourcePoint, side: sourceAnchor.side }
        let targetEndpoint = { point: targetPoint, side: targetAnchor.side }

        if (connectState?.isConnecting && connectState.reconnect?.edgeId === edge.id) {
          const moved = getReconnectPoint(connectState.to)
          if (moved) {
            if (connectState.reconnect.end === 'source') {
              sourceEndpoint = moved
            } else {
              targetEndpoint = moved
            }
          }
        }

        const path = getEdgePath({
          edge,
          source: sourceEndpoint,
          target: targetEndpoint
        })
        return { id: edge.id, edge, path }
      })
      .filter((line): line is { id: string; edge: Edge; path: { points: Point[]; svgPath: string } } => Boolean(line))
  }, [connectState?.isConnecting, connectState?.reconnect?.edgeId, connectState?.reconnect?.end, connectState?.to, edges, nodeMap, nodeSize])
  const getWorldPoint = useCallback(
    (event: { clientX: number; clientY: number; currentTarget: Element }) => {
      if (screenToWorld && containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        return screenToWorld(screenPoint)
      }
      const rect = event.currentTarget.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    },
    [containerRef, screenToWorld]
  )

  const getSegmentIndexOnPath = (pointWorld: Point, pathPoints: Point[]) => {
    let min = Number.POSITIVE_INFINITY
    let minIndex = Math.max(0, pathPoints.length - 2)
    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      const d = distancePointToSegment(pointWorld, pathPoints[i], pathPoints[i + 1])
      if (d < min) {
        min = d
        minIndex = i
      }
    }
    return minIndex
  }

  const handlePathPointerDown =
    (edge: Edge, pathPoints: Point[]) => (event: PointerEvent<SVGPathElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const pointWorld = getWorldPoint(event)
      if (!pointWorld) return
      if (event.shiftKey && onInsertPoint) {
        const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
        onInsertPoint(edge, pathPoints, segmentIndex, pointWorld)
        onSelectEdge?.(edge.id)
        return
      }
      onSelectEdge?.(edge.id)
    }

  const handlePathClick =
    (edge: Edge, pathPoints: Point[]) => (event: MouseEvent<SVGPathElement>) => {
      if (!onInsertPoint) return
      if (event.detail < 2) return
      event.preventDefault()
      event.stopPropagation()
      const pointWorld = getWorldPoint(event)
      if (!pointWorld) return
      const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
      onInsertPoint(edge, pathPoints, segmentIndex, pointWorld)
      onSelectEdge?.(edge.id)
    }

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
    >
      <style>
        {`
          @keyframes edge-dash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -100; }
          }
        `}
      </style>
      <defs>
        <marker
          id="edge-arrow-end"
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
        <marker
          id="edge-arrow-start"
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
      </defs>
      {paths.map((line) => {
        const baseStroke = line.edge.style?.stroke ?? '#2f2f33'
        const isSelected = line.id === selectedEdgeId
        const isHovered = line.id === hoveredEdgeId
        const stroke = isSelected ? '#2563eb' : baseStroke
        const baseWidth = line.edge.style?.strokeWidth ?? 2
        const strokeWidth = isSelected ? Math.max(baseWidth, 3) : isHovered ? baseWidth + 1 : baseWidth
        const isAnimated = Boolean(line.edge.style?.animated)
        const dashArray = line.edge.style?.dash ?? (isAnimated ? [6, 4] : undefined)
        const dash = dashArray?.join(' ')
        const animationDuration = Math.max(0.3, line.edge.style?.animationSpeed ?? 1.2)
        const resolveMarker = (value: string | undefined, fallbackId: string) => {
          if (!value) return undefined
          if (value.startsWith('url(')) return value
          if (value === 'arrow') return `url(#${fallbackId})`
          return `url(#${value})`
        }
        const markerStart = resolveMarker(line.edge.style?.markerStart, 'edge-arrow-start')
        const markerEnd = resolveMarker(line.edge.style?.markerEnd, 'edge-arrow-end')
        const hitWidth = Math.max(6, strokeWidth + hitTestThresholdScreen)
        return (
          <g key={line.id}>
            <path
              d={line.path.svgPath}
              fill="none"
              stroke="transparent"
              strokeWidth={hitWidth}
              pointerEvents="stroke"
              onPointerDown={handlePathPointerDown(line.edge, line.path.points)}
              onClick={handlePathClick(line.edge, line.path.points)}
              onPointerEnter={() => setHoveredEdgeId(line.id)}
              onPointerLeave={() => setHoveredEdgeId((prev) => (prev === line.id ? undefined : prev))}
            />
            <path
              d={line.path.svgPath}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
              markerStart={markerStart}
              markerEnd={markerEnd}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              style={{
                color: stroke,
                animation: isAnimated ? `edge-dash ${animationDuration}s linear infinite` : undefined
              }}
            />
          </g>
        )
      })}
    </svg>
  )
}
