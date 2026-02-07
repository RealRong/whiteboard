import { useCallback, useMemo } from 'react'
import type { PointerEvent } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { Node } from '@whiteboard/core'
import { useInstance, useInteraction, useViewportStore, useWhiteboardConfig } from '../../common/hooks'
import { useGroupRuntime } from './useGroupRuntime'
import { useSnapRuntime } from './useSnapRuntime'
import { useNodeTransient } from './useNodeTransient'
import { useNodeDrag } from './useNodeDrag'
import { useEdgeConnectRuntime } from '../../edge/hooks'
import { edgeSelectionAtom, nodeSelectionAtom, toolAtom } from '../../common/state'
import { applySelectionMode, getSelectionModeFromEvent } from '../utils/selection'
import type { SelectionMode } from '../../common/state'
import type { UseEdgeConnectReturn } from '../../edge/hooks'

export type NodeContainerHandlers = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  onPointerEnter: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLDivElement>) => void
}

type Options = {
  node: Node
}

export const useNodeInteraction = ({ node }: Options) => {
  const instance = useInstance()
  const viewport = useViewportStore()
  const { nodeSize } = useWhiteboardConfig()
  const updateSelection = useSetAtom(nodeSelectionAtom)
  const tool = useAtomValue(toolAtom)
  const setEdgeSelection = useSetAtom(edgeSelectionAtom)
  const { update: updateInteraction } = useInteraction()
  const edgeConnectRuntime = useEdgeConnectRuntime()
  const groupRuntime = useGroupRuntime()
  const snapRuntime = useSnapRuntime()
  const transientRuntime = useNodeTransient()
  const activeTool = (tool as 'select' | 'edge') ?? 'select'
  const edgeConnect: UseEdgeConnectReturn | undefined = edgeConnectRuntime ?? undefined

  const size = useMemo(
    () => ({
      width: node.size?.width ?? nodeSize.width,
      height: node.size?.height ?? nodeSize.height
    }),
    [node.size?.height, node.size?.width, nodeSize.height, nodeSize.width]
  )

  const applySelection = useCallback(
    (ids: string[], mode: SelectionMode = 'replace') => {
      setEdgeSelection(undefined)
      updateSelection((prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, mode)
      }))
    },
    [setEdgeSelection, updateSelection]
  )

  const toggleSelection = useCallback(
    (ids: string[]) => {
      setEdgeSelection(undefined)
      updateSelection((prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelectionMode(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    [setEdgeSelection, updateSelection]
  )

  const dragHandlers = useNodeDrag({
    core: instance.core,
    nodeId: node.id,
    nodeType: node.type,
    position: node.position,
    size,
    zoom: viewport.zoom,
    snap: snapRuntime,
    group: groupRuntime,
    transient: transientRuntime
  })

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activeTool === 'edge' && edgeConnect) {
        const container = edgeConnect.containerRef?.current
        if (container && edgeConnect.screenToWorld) {
          const rect = container.getBoundingClientRect()
          const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
          const worldPoint = edgeConnect.screenToWorld(screenPoint)
          const handled = edgeConnect.handleNodePointerDown(node.id, worldPoint, event)
          if (handled) return
        }
        return
      }

      if (event.button === 0) {
        const mode = getSelectionModeFromEvent(event.nativeEvent)
        if (mode === 'toggle') {
          toggleSelection([node.id])
        } else {
          applySelection([node.id], mode)
        }
      }

      dragHandlers.onPointerDown(event)
    },
    [activeTool, applySelection, dragHandlers, edgeConnect, node.id, toggleSelection]
  )

  const handleEdgeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, side: 'top' | 'right' | 'bottom' | 'left') => {
      event.preventDefault()
      event.stopPropagation()
      edgeConnect?.startFromHandle(node.id, side, event.pointerId)
    },
    [edgeConnect, node.id]
  )

  const handlePointerEnter = useCallback(
    (_event: PointerEvent<HTMLDivElement>) => {
      updateInteraction({ hover: { nodeId: node.id } })
    },
    [node.id, updateInteraction]
  )

  const handlePointerLeave = useCallback(
    (_event: PointerEvent<HTMLDivElement>) => {
      updateInteraction({ hover: { nodeId: undefined } })
    },
    [updateInteraction]
  )

  const containerHandlers = useMemo<NodeContainerHandlers>(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: dragHandlers.onPointerMove,
      onPointerUp: dragHandlers.onPointerUp,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave
    }),
    [dragHandlers.onPointerMove, dragHandlers.onPointerUp, handlePointerDown, handlePointerEnter, handlePointerLeave]
  )

  return {
    containerHandlers,
    handleEdgeHandlePointerDown
  }
}
