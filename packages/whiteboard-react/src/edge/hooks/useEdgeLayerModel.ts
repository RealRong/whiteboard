import { useMemo } from 'react'
import type { Core, Edge, Node, NodeId, Point } from '@whiteboard/core'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Size } from '../../common/types'
import type { UseEdgeConnectReturn } from './useEdgeConnect'
import { useEdgePreview } from './useEdgePreview'
import { useEdgePointInsertion } from './useEdgePointInsertion'

type Options = {
  core: Core
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  zoom: number
  containerRef?: RefObject<HTMLElement>
  screenToWorld?: (point: Point) => Point
  edgeConnect: UseEdgeConnectReturn
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
  edgeConnect,
  nodeMap,
  tool
}: Options) => {
  const handleInsertPoint = useEdgePointInsertion(core)
  const { previewFrom, previewTo, hoverSnap } = useEdgePreview({
    state: edgeConnect.state,
    nodeMap,
    nodeSize
  })

  const edgeLayerProps = useMemo(
    () => ({
      nodes,
      edges,
      nodeSize,
      zoom,
      containerRef,
      screenToWorld,
      selectedEdgeId: edgeConnect.selectedEdgeId,
      onSelectEdge: (id?: string) => edgeConnect.selectEdge(id),
      onInsertPoint: handleInsertPoint,
      connectState: edgeConnect.state
    }),
    [containerRef, edgeConnect, edges, handleInsertPoint, nodeSize, nodes, screenToWorld, zoom]
  )

  const endpointHandlesProps = useMemo(
    () => ({
      edges,
      nodes,
      nodeSize,
      selectedEdgeId: edgeConnect.selectedEdgeId,
      onStartReconnect: (edgeId: string, end: 'source' | 'target', event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()
        edgeConnect.startReconnect(edgeId, end, event.pointerId)
      }
    }),
    [edgeConnect, edges, nodeSize, nodes]
  )

  const controlPointHandlesProps = useMemo(
    () => ({
      core,
      edges,
      selectedEdgeId: edgeConnect.selectedEdgeId,
      containerRef,
      screenToWorld
    }),
    [containerRef, core, edgeConnect.selectedEdgeId, edges, screenToWorld]
  )

  const previewProps = useMemo(
    () => ({
      from: edgeConnect.state.isConnecting && !edgeConnect.state.reconnect ? previewFrom : undefined,
      to: edgeConnect.state.isConnecting && !edgeConnect.state.reconnect ? previewTo : undefined,
      snap: tool === 'edge' ? hoverSnap : undefined
    }),
    [edgeConnect.state.isConnecting, edgeConnect.state.reconnect, hoverSnap, previewFrom, previewTo, tool]
  )

  return {
    edgeLayerProps,
    endpointHandlesProps,
    controlPointHandlesProps,
    previewProps
  }
}
