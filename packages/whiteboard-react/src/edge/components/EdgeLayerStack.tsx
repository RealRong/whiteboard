import { useEdgeConnect, useEdgeLayerModel } from '../hooks'
import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeLayer } from './EdgeLayer'
import { EdgePreviewLayer } from './EdgePreviewLayer'
import { useAtomValue } from 'jotai'
import {
  useCanvasNodes,
  useInstance,
  useNodeMap,
  useViewportStore,
  useVisibleEdges,
  useWhiteboardConfig
} from '../../common/hooks'
import { toolAtom } from '../../common/state'

export const EdgeLayerStack = () => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const canvasNodes = useCanvasNodes()
  const visibleEdges = useVisibleEdges()
  const nodeMap = useNodeMap()
  const tool = useAtomValue(toolAtom)
  const viewportState = useViewportStore()
  const edgeConnect = useEdgeConnect()

  const { edgeLayerProps, endpointHandlesProps, controlPointHandlesProps, previewProps } = useEdgeLayerModel({
    core: instance.core,
    nodes: canvasNodes,
    edges: visibleEdges,
    nodeSize,
    zoom: viewportState.zoom,
    containerRef: instance.containerRef ?? undefined,
    screenToWorld: instance.viewport.screenToWorld ?? undefined,
    edgeConnect,
    nodeMap,
    tool: (tool as 'select' | 'edge') ?? 'select'
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
