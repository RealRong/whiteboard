import type { Edge, Node } from '@whiteboard/core'
import type { PointerEvent } from 'react'
import type { Size } from '../../common/types'
import { getAnchorPoint, getNodeRect, getRectCenter } from '../../common/utils/geometry'

type EdgeEndpointHandlesProps = {
  edges: Edge[]
  nodes: Node[]
  nodeSize: Size
  selectedEdgeId?: string
  onStartReconnect: (edgeId: string, end: 'source' | 'target', event: PointerEvent<HTMLDivElement>) => void
}

export const EdgeEndpointHandles = ({
  edges,
  nodes,
  nodeSize,
  selectedEdgeId,
  onStartReconnect
}: EdgeEndpointHandlesProps) => {
  if (!selectedEdgeId) return null
  const edge = edges.find((item) => item.id === selectedEdgeId)
  if (!edge) return null
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const sourceNode = nodeMap.get(edge.source.nodeId)
  const targetNode = nodeMap.get(edge.target.nodeId)
  if (!sourceNode || !targetNode) return null
  const sourceRect = getNodeRect(sourceNode, nodeSize)
  const targetRect = getNodeRect(targetNode, nodeSize)
  const sourceRotation = typeof sourceNode.rotation === 'number' ? sourceNode.rotation : 0
  const targetRotation = typeof targetNode.rotation === 'number' ? targetNode.rotation : 0
  const sourceCenter = getRectCenter(sourceRect)
  const targetCenter = getRectCenter(targetRect)
  const getAutoAnchor = (rect: { x: number; y: number; width: number; height: number }, otherCenter: { x: number; y: number }) => {
    const center = getRectCenter(rect)
    const dx = otherCenter.x - center.x
    const dy = otherCenter.y - center.y
    const side =
      Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
    return { side, offset: 0.5 }
  }
  const sourceAnchor = edge.source.anchor ?? getAutoAnchor(sourceRect, targetCenter)
  const targetAnchor = edge.target.anchor ?? getAutoAnchor(targetRect, sourceCenter)
  const sourcePoint = getAnchorPoint(sourceRect, sourceAnchor, sourceRotation)
  const targetPoint = getAnchorPoint(targetRect, targetAnchor, targetRotation)

  const renderHandle = (end: 'source' | 'target', point: { x: number; y: number }) => (
    <div
      key={end}
      data-selection-ignore
      onPointerDown={(event) => onStartReconnect(edge.id, end, event)}
      style={{
        position: 'absolute',
        left: point.x - 6,
        top: point.y - 6,
        width: 12,
        height: 12,
        borderRadius: 999,
        background: '#ffffff',
        border: '2px solid #2563eb',
        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
        cursor: 'grab',
        pointerEvents: 'auto',
        zIndex: 8
      }}
    />
  )

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {renderHandle('source', sourcePoint)}
      {renderHandle('target', targetPoint)}
    </div>
  )
}
