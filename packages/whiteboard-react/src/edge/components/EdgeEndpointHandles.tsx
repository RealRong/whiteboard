import type { CSSProperties } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useInstance, useReadAtom, useWhiteboardSelector } from '../../common/hooks'
import { useEdgeConnectInteraction } from '../hooks/useEdgeConnectInteraction'

export const EdgeEndpointHandles = () => {
  const { handleReconnectPointerDown } = useEdgeConnectInteraction()
  const stateSelectedEdgeId = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedEdgeId,
    {
      keys: ['selection']
    }
  )
  const instance = useInstance()
  const endpoints = useReadAtom(instance.read.atoms.edgeSelectedEndpoints)
  if (!stateSelectedEdgeId || !endpoints) return null

  const renderHandle = (end: 'source' | 'target', point: { x: number; y: number }) => (
    <div
      key={end}
      data-selection-ignore
      data-input-role="edge-endpoint-handle"
      data-edge-id={stateSelectedEdgeId}
      data-edge-end={end}
      className="wb-edge-endpoint-handle"
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        handleReconnectPointerDown(event, stateSelectedEdgeId, end)
      }}
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
