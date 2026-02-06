import { useEdgeConnect, useEdgeLayerModel } from '../hooks'
import { useEdgeConnectLifecycle } from '../lifecycle'
import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeLayer } from './EdgeLayer'
import { EdgePreviewLayer } from './EdgePreviewLayer'
import { useInstance, useViewGraph, useViewportStore, useWhiteboardConfig } from '../../common/hooks'
import { useSelection } from '../../node/hooks'
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { edgeConnectRuntimeAtom } from '../state/edgeConnectRuntimeAtom'

export const EdgeLayerStack = () => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const viewGraph = useViewGraph()
  const selectionState = useSelection()
  const viewportState = useViewportStore()
  const edgeConnect = useEdgeConnect()
  const setEdgeConnectRuntime = useSetAtom(edgeConnectRuntimeAtom)
  useEdgeConnectLifecycle(edgeConnect)

  useEffect(() => {
    setEdgeConnectRuntime(edgeConnect)
  }, [edgeConnect, setEdgeConnectRuntime])

  const { edgeLayerProps, endpointHandlesProps, controlPointHandlesProps, previewProps } = useEdgeLayerModel({
    core: instance.core,
    nodes: viewGraph.canvasNodes,
    edges: viewGraph.visibleEdges,
    nodeSize,
    zoom: viewportState.zoom,
    containerRef: instance.containerRef ?? undefined,
    screenToWorld: instance.viewport.screenToWorld ?? undefined,
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
