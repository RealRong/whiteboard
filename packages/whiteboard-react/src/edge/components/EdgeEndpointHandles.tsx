import type { CSSProperties, PointerEvent } from 'react'
import { useEdgeSelectedEndpointsView, useInstance, useWhiteboardSelector } from '../../common/hooks'
import { toPointerInput } from '../../common/pointerInput'

export const EdgeEndpointHandles = () => {
  const instance = useInstance()
  const stateSelectedEdgeId = useWhiteboardSelector('edgeSelection')
  const endpoints = useEdgeSelectedEndpointsView()
  if (!stateSelectedEdgeId || !endpoints) return null

  const handleStartReconnect = (edgeId: string, end: 'source' | 'target', event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    instance.runtime.interaction.edgeConnect.startReconnect(edgeId, end, toPointerInput(instance, event))
  }

  const renderHandle = (end: 'source' | 'target', point: { x: number; y: number }) => (
    <div
      key={end}
      data-selection-ignore
      className="wb-edge-endpoint-handle"
      onPointerDown={(event) => handleStartReconnect(stateSelectedEdgeId, end, event)}
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
