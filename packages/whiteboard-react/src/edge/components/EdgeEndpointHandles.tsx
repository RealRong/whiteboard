import type { CSSProperties, PointerEvent } from 'react'
import { useInstance } from '../../common/hooks'
import { useEdgeConnectLayerState, useVisibleEdges } from '../hooks'

type EdgeEndpointHandlesProps = {
  onStartReconnect?: (edgeId: string, end: 'source' | 'target', event: PointerEvent<HTMLDivElement>) => void
}

export const EdgeEndpointHandles = ({ onStartReconnect }: EdgeEndpointHandlesProps) => {
  const instance = useInstance()
  const visibleEdges = useVisibleEdges()
  const { selectedEdgeId: stateSelectedEdgeId } = useEdgeConnectLayerState()
  if (!stateSelectedEdgeId) return null
  const edge = visibleEdges.find((item) => item.id === stateSelectedEdgeId)
  if (!edge) return null
  const endpoints = instance.query.getEdgeResolvedEndpoints(edge)
  if (!endpoints) return null

  const handleStartReconnect = onStartReconnect ?? ((edgeId: string, end: 'source' | 'target', event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    instance.commands.edgeConnect.startReconnect(edgeId, end, event.pointerId)
  })

  const renderHandle = (end: 'source' | 'target', point: { x: number; y: number }) => (
    <div
      key={end}
      data-selection-ignore
      className="wb-edge-endpoint-handle"
      onPointerDown={(event) => handleStartReconnect(edge.id, end, event)}
      style={{
        '--wb-edge-endpoint-x': point.x,
        '--wb-edge-endpoint-y': point.y
      } as CSSProperties}
    />
  )

  return (
    <div className="wb-edge-endpoint-layer">
      {renderHandle('source', endpoints.source.point)}
      {renderHandle('target', endpoints.target.point)}
    </div>
  )
}
