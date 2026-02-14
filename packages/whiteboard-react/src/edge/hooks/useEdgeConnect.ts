import { useCallback, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '@whiteboard/core'
import { useInstance, useWhiteboardSelector } from '../../common/hooks'
import type { UseEdgeConnectLayerStateReturn, UseEdgeConnectReturn } from 'types/edge'

const useEdgeConnectSharedState = () => {
  const instance = useInstance()
  const canvasNodes = useWhiteboardSelector('canvasNodes')
  const state = useWhiteboardSelector('edgeConnect')
  const selectedEdgeId = useWhiteboardSelector('edgeSelection')
  const tool = (useWhiteboardSelector('tool') as 'select' | 'edge') ?? 'select'
  const nodeRects = useMemo(() => instance.query.getCanvasNodeRects(), [canvasNodes, instance])

  return useMemo(
    () => ({
      state,
      selectedEdgeId,
      tool,
      containerRef: instance.runtime.containerRef,
      screenToWorld: instance.runtime.viewport.screenToWorld,
      nodeRects,
      getAnchorFromPoint: instance.query.getAnchorFromPoint
    }),
    [instance, nodeRects, selectedEdgeId, state, tool]
  )
}

export const useEdgeConnectLayerState = (): UseEdgeConnectLayerStateReturn => {
  const state = useWhiteboardSelector('edgeConnect')
  const selectedEdgeId = useWhiteboardSelector('edgeSelection')

  return useMemo(
    () => ({
      state,
      selectedEdgeId
    }),
    [selectedEdgeId, state]
  )
}

export const useEdgeConnect = (): UseEdgeConnectReturn => {
  const instance = useInstance()
  const state = useEdgeConnectSharedState()

  const handleNodePointerDown = useCallback(
    (nodeId: string, pointWorld: Point, event: ReactPointerEvent<HTMLElement>) => {
      const handled = instance.commands.edgeConnect.handleNodePointerDown(nodeId, pointWorld, event.pointerId)
      if (!handled) return false
      event.preventDefault()
      event.stopPropagation()
      return true
    },
    [instance]
  )

  return useMemo(
    () => ({
      ...state,
      startFromHandle: instance.commands.edgeConnect.startFromHandle,
      startFromPoint: instance.commands.edgeConnect.startFromPoint,
      startReconnect: instance.commands.edgeConnect.startReconnect,
      updateTo: instance.commands.edgeConnect.updateTo,
      commitTo: instance.commands.edgeConnect.commitTo,
      cancel: instance.commands.edgeConnect.cancel,
      selectEdge: instance.commands.edge.select,
      updateHover: instance.commands.edgeConnect.updateHover,
      handleNodePointerDown
    }),
    [handleNodePointerDown, instance, state]
  )
}
