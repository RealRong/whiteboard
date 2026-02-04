import { useAtomValue } from 'jotai'
import { useEdgeLayerModel } from '../hooks/useEdgeLayerModel'
import { EdgeLayer } from './EdgeLayer'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgePreviewLayer } from './EdgePreviewLayer'
import { whiteboardInputAtom, nodeSizeAtom } from '../../common/state/whiteboardInputAtoms'
import { viewGraphAtom } from '../../common/state/whiteboardDerivedAtoms'
import { selectionAtom, viewportAtom } from '../../common/state/whiteboardAtoms'
import { useEdgeConnectManager } from '../hooks/useEdgeConnect'

export const EdgeLayerStack = () => {
  const input = useAtomValue(whiteboardInputAtom)
  const nodeSize = useAtomValue(nodeSizeAtom)
  const viewGraph = useAtomValue(viewGraphAtom)
  const selectionState = useAtomValue(selectionAtom)
  const viewportState = useAtomValue(viewportAtom)
  const edgeConnect = useEdgeConnectManager()

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
