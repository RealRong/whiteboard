import type { Edge } from '@whiteboard/core'
import type { PointerEvent } from 'react'
import { useInstance } from '../../common/hooks'

type EdgeEndpointHandlesProps = {
  edges: Edge[]
  selectedEdgeId?: string
  onStartReconnect: (edgeId: string, end: 'source' | 'target', event: PointerEvent<HTMLDivElement>) => void
}

export const EdgeEndpointHandles = ({
  edges,
  selectedEdgeId,
  onStartReconnect
}: EdgeEndpointHandlesProps) => {
  const instance = useInstance()
  const HANDLE_SIZE = 12
  const handleHalfExpr = `calc(${HANDLE_SIZE}px / var(--wb-zoom, 1) / 2)`
  if (!selectedEdgeId) return null
  const edge = edges.find((item) => item.id === selectedEdgeId)
  if (!edge) return null
  const endpoints = instance.query.getEdgeResolvedEndpoints(edge)
  if (!endpoints) return null

  const renderHandle = (end: 'source' | 'target', point: { x: number; y: number }) => (
    <div
      key={end}
      data-selection-ignore
      onPointerDown={(event) => onStartReconnect(edge.id, end, event)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `calc(${HANDLE_SIZE}px / var(--wb-zoom, 1))`,
        height: `calc(${HANDLE_SIZE}px / var(--wb-zoom, 1))`,
        borderRadius: 999,
        background: '#ffffff',
        border: 'calc(2px / var(--wb-zoom, 1)) solid #2563eb',
        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
        cursor: 'grab',
        pointerEvents: 'auto',
        zIndex: 8,
        transform: `translate(calc(${point.x}px - ${handleHalfExpr}), calc(${point.y}px - ${handleHalfExpr}))`
      }}
    />
  )

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {renderHandle('source', endpoints.source.point)}
      {renderHandle('target', endpoints.target.point)}
    </div>
  )
}
