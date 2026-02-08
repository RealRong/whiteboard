import { useMemo } from 'react'
import { useEdgeConnectState, useEdgeLayerModel } from '../hooks'
import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeLayer } from './EdgeLayer'
import { EdgePreviewLayer } from './EdgePreviewLayer'
import {
  useActiveTool,
  useCanvasNodes,
  useInstance,
  useNodeMap,
  useVisibleEdges,
  useWhiteboardConfig
} from '../../common/hooks'

export const EdgeLayerStack = () => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const canvasNodes = useCanvasNodes()
  const visibleEdges = useVisibleEdges()
  const nodeMap = useNodeMap()
  const tool = useActiveTool()
  const edgeConnectState = useEdgeConnectState()

  const edgeConnectActions = useMemo(
    () => ({
      selectEdge: instance.api.edge.select,
      startReconnect: instance.api.edgeConnect.startReconnect
    }),
    [instance]
  )

  const { edgeLayerProps, endpointHandlesProps, controlPointHandlesProps, previewProps } = useEdgeLayerModel({
    core: instance.core,
    nodes: canvasNodes,
    edges: visibleEdges,
    nodeSize,
    zoom: instance.viewport.getZoom(),
    containerRef: instance.containerRef ?? undefined,
    screenToWorld: instance.viewport.screenToWorld ?? undefined,
    edgeConnectState,
    edgeConnectActions,
    nodeMap,
    tool
  })

  return (
    <>
      <EdgeLayer
        nodes={edgeLayerProps.nodes}
        edges={edgeLayerProps.edges}
        nodeSize={edgeLayerProps.nodeSize}
        zoom={edgeLayerProps.zoom}
        containerRef={edgeLayerProps.containerRef}
        screenToWorld={edgeLayerProps.screenToWorld}
        selectedEdgeId={edgeLayerProps.selectedEdgeId}
        onSelectEdge={edgeLayerProps.onSelectEdge}
        onInsertPoint={edgeLayerProps.onInsertPoint}
        connectState={edgeLayerProps.connectState}
      />
      <EdgeEndpointHandles
        edges={endpointHandlesProps.edges}
        nodes={endpointHandlesProps.nodes}
        nodeSize={endpointHandlesProps.nodeSize}
        selectedEdgeId={endpointHandlesProps.selectedEdgeId}
        onStartReconnect={endpointHandlesProps.onStartReconnect}
      />
      <EdgeControlPointHandles
        core={controlPointHandlesProps.core}
        edges={controlPointHandlesProps.edges}
        selectedEdgeId={controlPointHandlesProps.selectedEdgeId}
        containerRef={controlPointHandlesProps.containerRef}
        screenToWorld={controlPointHandlesProps.screenToWorld}
      />
      <EdgePreviewLayer
        from={previewProps.from}
        to={previewProps.to}
        snap={previewProps.snap}
      />
    </>
  )
}
