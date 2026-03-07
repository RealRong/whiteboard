import type { CSSProperties } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS
} from '@whiteboard/engine'
import { useInstance, useReadGetter, useWhiteboardSelector } from '../../common/hooks'
import { useEdgeConnectInteraction } from '../hooks/useEdgeConnectInteraction'

export const EdgeEndpointHandles = () => {
  const { handleReconnectPointerDown } = useEdgeConnectInteraction()
  const stateSelectedEdgeId = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedEdgeId,
    {
      keys: [READ_STATE_KEYS.selection]
    }
  )
  const instance = useInstance()
  const endpoints = useReadGetter(
    () => (
      stateSelectedEdgeId
        ? instance.read.projection.edge.byId.get(stateSelectedEdgeId)?.endpoints
        : undefined
    ),
    {
      keys: [READ_STATE_KEYS.selection, READ_SUBSCRIPTION_KEYS.edge]
    }
  )
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
