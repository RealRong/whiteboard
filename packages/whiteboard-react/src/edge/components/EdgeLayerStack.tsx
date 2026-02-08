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
      selectEdge: instance.commands.edge.select,
      startReconnect: instance.commands.edgeConnect.startReconnect
    }),
    [instance]
  )

  const { edgeLayerProps, endpointHandlesProps, controlPointHandlesProps, previewProps } = useEdgeLayerModel({
    core: instance.runtime.core,
    nodes: canvasNodes,
    edges: visibleEdges,
    nodeSize,
    zoom: instance.runtime.viewport.getZoom(),
    containerRef: instance.runtime.containerRef ?? undefined,
    screenToWorld: instance.runtime.viewport.screenToWorld ?? undefined,
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
