import { useEdgeConnect, useEdgeLayerModel } from '../hooks'
import { useEdgeConnectLifecycle } from '../lifecycle'
import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeLayer } from './EdgeLayer'
import { EdgePreviewLayer } from './EdgePreviewLayer'
import { useNodeSize, useViewGraph, useViewportStore, useWhiteboardInput } from '../../common/hooks'
import { useSelection } from '../../node/hooks'

export const EdgeLayerStack = () => {
  const input = useWhiteboardInput()
  const nodeSize = useNodeSize()
  const viewGraph = useViewGraph()
  const selectionState = useSelection()
  const viewportState = useViewportStore()
  const edgeConnect = useEdgeConnect()
  useEdgeConnectLifecycle(edgeConnect)

  const { edgeLayerProps, endpointHandlesProps, controlPointHandlesProps, previewProps } = useEdgeLayerModel({
    core: input.core!,
    nodes: viewGraph.canvasNodes,
    edges: viewGraph.visibleEdges,
    nodeSize: nodeSize ?? { width: 1, height: 1 },
    zoom: viewportState.zoom,
    containerRef: input.containerRef ?? undefined,
    screenToWorld: input.screenToWorld ?? undefined,
    edgeConnect,
    nodeMap: viewGraph.nodeMap,
    tool: selectionState.tool as 'select' | 'edge'
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
