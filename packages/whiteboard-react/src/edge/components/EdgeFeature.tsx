import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeId, Point } from '@whiteboard/core/types'
import type { RefObject } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactDivPointerEvent
} from 'react'
import { useInternalInstance as useInstance, useTransientReset } from '../../common/hooks'
import {
  useTransientConnection,
  type NodeReader,
  type Transient
} from '../../transient'
import { useEdgeConnect } from '../hooks/connect/useEdgeConnect'
import { useEdgeRouting } from '../hooks/routing/useEdgeRouting'
import { useSelectedEdgeView } from '../hooks/useSelectedEdgeView'
import { EdgeLayer } from './EdgeLayer'

const readPointerWorld = (
  instance: ReturnType<typeof useInstance>,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>
): Point => {
  const screen = instance.viewport.clientToScreen(event.clientX, event.clientY)
  return instance.viewport.screenToWorld(screen)
}

export const EdgeFeature = ({
  containerRef,
  node,
  connection,
  edge
}: {
  containerRef: RefObject<HTMLDivElement | null>
  node: NodeReader
  connection: Transient['connection']
  edge: Transient['edge']
}) => {
  const instance = useInstance()
  const preview = useTransientConnection(connection)
  const { cancelConnectSession } = useEdgeConnect({
    containerRef,
    connection
  })
  const {
    cancelRoutingSession,
    handleRoutingPointerDown,
    handleRoutingKeyDown
  } = useEdgeRouting(edge)
  const selectedEdgeView = useSelectedEdgeView(node, edge)

  const reset = useCallback(() => {
    cancelConnectSession()
    cancelRoutingSession()
  }, [cancelConnectSession, cancelRoutingSession])

  const handleEdgePathPointerDown = useCallback((
    event: ReactPointerEvent<SVGPathElement>,
  ) => {
    if (event.button !== 0) return

    const edgeId = event.currentTarget.closest('[data-edge-id]')?.getAttribute('data-edge-id') as EdgeId | null
    if (!edgeId) return

    if (event.shiftKey || event.detail >= 2) {
      instance.commands.edge.routing.insertAtPoint(edgeId, readPointerWorld(instance, event))
    }

    instance.commands.selection.selectEdge(edgeId)
    event.preventDefault()
    event.stopPropagation()
  }, [instance])

  useTransientReset(reset)

  const { activePointerId, from, to, snap, showPreviewLine } = preview

  return (
    <>
      <EdgeLayer
        edge={edge}
        node={node}
        handleEdgePathPointerDown={handleEdgePathPointerDown}
      />
      {selectedEdgeView && (
        <div className="wb-edge-endpoint-layer">
          <div
            data-selection-ignore
            data-input-role="edge-endpoint-handle"
            data-edge-id={selectedEdgeView.edgeId}
            data-edge-end="source"
            className="wb-edge-endpoint-handle"
            style={{
              '--wb-edge-endpoint-x': selectedEdgeView.endpoints.source.point.x,
              '--wb-edge-endpoint-y': selectedEdgeView.endpoints.source.point.y
            } as CSSProperties}
          />
          <div
            data-selection-ignore
            data-input-role="edge-endpoint-handle"
            data-edge-id={selectedEdgeView.edgeId}
            data-edge-end="target"
            className="wb-edge-endpoint-handle"
            style={{
              '--wb-edge-endpoint-x': selectedEdgeView.endpoints.target.point.x,
              '--wb-edge-endpoint-y': selectedEdgeView.endpoints.target.point.y
            } as CSSProperties}
          />
        </div>
      )}
      {selectedEdgeView && selectedEdgeView.routingHandles.length > 0 && (
        <div className="wb-edge-control-point-layer">
          {selectedEdgeView.routingHandles.map((handle) => (
            <div
              key={handle.key}
              data-selection-ignore
              className="wb-edge-control-point-handle"
              data-active={handle.active ? 'true' : undefined}
              data-input-role="edge-routing-point"
              data-edge-id={handle.edgeId}
              data-routing-index={handle.index}
              onPointerDown={(event: ReactDivPointerEvent<HTMLDivElement>) => {
                handleRoutingPointerDown(event, handle.edgeId, handle.index)
              }}
              onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                handleRoutingKeyDown(event, handle.edgeId, handle.index)
              }}
              style={{
                '--wb-edge-control-point-x': handle.point.x,
                '--wb-edge-control-point-y': handle.point.y,
                '--wb-edge-control-point-scale': handle.active ? 1.08 : 1
              } as CSSProperties}
              tabIndex={0}
            />
          ))}
        </div>
      )}
      {(from || to || snap) && (
        <svg
          width="100%"
          height="100%"
          overflow="visible"
          className="wb-edge-preview-layer"
        >
          {showPreviewLine && from && to && (
            <>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="rgba(17,24,39,0.7)"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={from.x} cy={from.y} r={4} fill="#111827" className="wb-edge-preview-point" />
              <circle cx={to.x} cy={to.y} r={4} fill="#111827" className="wb-edge-preview-point" />
            </>
          )}
          {snap && (
            <circle
              cx={snap.x}
              cy={snap.y}
              r={6}
              fill="rgba(59,130,246,0.2)"
              stroke="#2563eb"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="wb-edge-preview-point"
              data-active={activePointerId !== undefined ? 'true' : 'false'}
            />
          )}
        </svg>
      )}
    </>
  )
}
