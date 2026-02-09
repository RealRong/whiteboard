import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEdgeConnectLayerState, useEdgePointInsertion, useEdgePreview } from '../hooks'
import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeLayer } from './EdgeLayer'
import { EdgePreviewLayer } from './EdgePreviewLayer'
import {
  useActiveTool,
  useInstance,
  useVisibleEdges
} from '../../common/hooks'

export const EdgeLayerStack = () => {
  const instance = useInstance()
  const visibleEdges = useVisibleEdges()
  const tool = useActiveTool()
  const edgeConnectState = useEdgeConnectLayerState()
  const handleInsertPoint = useEdgePointInsertion()
  const { previewFrom, previewTo, hoverSnap } = useEdgePreview({
    state: edgeConnectState.state
  })

  const handleStartReconnect = useCallback(
    (edgeId: string, end: 'source' | 'target', event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      instance.commands.edgeConnect.startReconnect(edgeId, end, event.pointerId)
    },
    [instance]
  )
  const containerRef = instance.runtime.containerRef ?? undefined
  const screenToWorld = instance.runtime.viewport.screenToWorld ?? undefined
  const selectedEdgeId = edgeConnectState.selectedEdgeId
  const connectState = edgeConnectState.state

  return (
    <>
      <EdgeLayer
        edges={visibleEdges}
        zoom={instance.runtime.viewport.getZoom()}
        containerRef={containerRef}
        screenToWorld={screenToWorld}
        selectedEdgeId={selectedEdgeId}
        onSelectEdge={instance.commands.edge.select}
        onInsertPoint={handleInsertPoint}
        connectState={connectState}
      />
      <EdgeEndpointHandles
        edges={visibleEdges}
        selectedEdgeId={selectedEdgeId}
        onStartReconnect={handleStartReconnect}
      />
      <EdgeControlPointHandles
        edges={visibleEdges}
        selectedEdgeId={selectedEdgeId}
        containerRef={containerRef}
        screenToWorld={screenToWorld}
      />
      <EdgePreviewLayer
        from={connectState.isConnecting && !connectState.reconnect ? previewFrom : undefined}
        to={connectState.isConnecting && !connectState.reconnect ? previewTo : undefined}
        snap={tool === 'edge' ? hoverSnap : undefined}
      />
    </>
  )
}
