import { useCallback, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '@whiteboard/core'
import { useInstance, useInstanceAtomValue } from '../../common/hooks'
import { edgeConnectLayerStateAtom, edgeConnectViewStateAtom } from '../state'
import type {
  UseEdgeConnectLayerStateReturn,
  UseEdgeConnectReturn,
  UseEdgeConnectStateReturn
} from 'types/edge'

export const useEdgeConnectState = (): UseEdgeConnectStateReturn => {
  const instance = useInstance()
  const { canvasNodes, state, selectedEdgeId, tool } = useInstanceAtomValue(edgeConnectViewStateAtom)

  const screenToWorld = instance.runtime.viewport.screenToWorld ?? undefined
  const containerRef = instance.runtime.containerRef ?? undefined
  const nodeRects = useMemo(() => instance.query.getCanvasNodeRects(), [canvasNodes, instance])

  return useMemo(
    () => ({
      state,
      selectedEdgeId,
      tool,
      containerRef,
      screenToWorld,
      nodeRects,
      getAnchorFromPoint: instance.query.getAnchorFromPoint
    }),
    [containerRef, instance, nodeRects, screenToWorld, selectedEdgeId, state, tool]
  )
}

export const useEdgeConnectLayerState = (): UseEdgeConnectLayerStateReturn => {
  const { state, selectedEdgeId } = useInstanceAtomValue(edgeConnectLayerStateAtom)
  return {
    state,
    selectedEdgeId
  }
}

export const useEdgeConnect = (): UseEdgeConnectReturn => {
  const instance = useInstance()
  const state = useEdgeConnectState()

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

export const edgeConnect = {
  useState: useEdgeConnectState,
  useConnect: useEdgeConnect
}
