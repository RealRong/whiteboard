import type { CSSProperties } from 'react'
import { useEdgeSelectedEndpointsView, useWhiteboardSelector } from '../../common/hooks'

export const EdgeEndpointHandles = () => {
  const stateSelectedEdgeId = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedEdgeId,
    {
      keys: ['selection']
    }
  )
  const endpoints = useEdgeSelectedEndpointsView()
  if (!stateSelectedEdgeId || !endpoints) return null

  const renderHandle = (end: 'source' | 'target', point: { x: number; y: number }) => (
    <div
      key={end}
      data-selection-ignore
      data-input-role="edge-endpoint-handle"
      data-edge-id={stateSelectedEdgeId}
      data-edge-end={end}
      className="wb-edge-endpoint-handle"
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
