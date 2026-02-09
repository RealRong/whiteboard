import { useMemo } from 'react'
import type { Core, Edge, Node, NodeId, Point } from '@whiteboard/core'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Size } from 'types/common'
import type { UseEdgeConnectLayerStateReturn } from 'types/edge'
import { useEdgePreview } from './useEdgePreview'
import { useEdgePointInsertion } from './useEdgePointInsertion'

type EdgeLayerActions = {
  selectEdge: (id?: string) => void
  startReconnect: (edgeId: string, end: 'source' | 'target', pointerId?: number) => void
}

type Options = {
  core: Core
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  zoom: number
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  edgeConnectState: UseEdgeConnectLayerStateReturn
  edgeConnectActions: EdgeLayerActions
  nodeMap: Map<NodeId, Node>
  tool: 'select' | 'edge'
}

export const useEdgeLayerModel = ({
  core,
  nodes,
  edges,
  nodeSize,
  zoom,
  containerRef,
  screenToWorld,
  edgeConnectState,
  edgeConnectActions,
  nodeMap,
  tool
}: Options) => {
  const handleInsertPoint = useEdgePointInsertion(core)
  const { previewFrom, previewTo, hoverSnap } = useEdgePreview({
    state: edgeConnectState.state,
    nodeMap
  })

  const edgeLayerProps = useMemo(
    () => ({
      nodes,
      edges,
      nodeSize,
      zoom,
      containerRef,
      screenToWorld,
      selectedEdgeId: edgeConnectState.selectedEdgeId,
      onSelectEdge: (id?: string) => edgeConnectActions.selectEdge(id),
      onInsertPoint: handleInsertPoint,
      connectState: edgeConnectState.state
    }),
    [
      containerRef,
      edgeConnectActions,
      edgeConnectState.selectedEdgeId,
      edgeConnectState.state,
      edges,
      handleInsertPoint,
      nodeSize,
      nodes,
      screenToWorld,
      zoom
    ]
  )

  const endpointHandlesProps = useMemo(
    () => ({
      edges,
      nodes,
      nodeSize,
      selectedEdgeId: edgeConnectState.selectedEdgeId,
      onStartReconnect: (edgeId: string, end: 'source' | 'target', event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()
        edgeConnectActions.startReconnect(edgeId, end, event.pointerId)
      }
    }),
    [edgeConnectActions, edgeConnectState.selectedEdgeId, edges, nodeSize, nodes]
  )

  const controlPointHandlesProps = useMemo(
    () => ({
      core,
      edges,
      selectedEdgeId: edgeConnectState.selectedEdgeId,
      containerRef,
      screenToWorld
    }),
    [containerRef, core, edgeConnectState.selectedEdgeId, edges, screenToWorld]
  )

  const previewProps = useMemo(
    () => ({
      from: edgeConnectState.state.isConnecting && !edgeConnectState.state.reconnect ? previewFrom : undefined,
      to: edgeConnectState.state.isConnecting && !edgeConnectState.state.reconnect ? previewTo : undefined,
      snap: tool === 'edge' ? hoverSnap : undefined
    }),
    [edgeConnectState.state.isConnecting, edgeConnectState.state.reconnect, hoverSnap, previewFrom, previewTo, tool]
  )

  return {
    edgeLayerProps,
    endpointHandlesProps,
    controlPointHandlesProps,
    previewProps
  }
}
