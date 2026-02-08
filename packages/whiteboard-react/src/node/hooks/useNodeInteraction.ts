import { useCallback, useMemo } from 'react'
import type { PointerEvent } from 'react'
import type { NodeHandleSide, NodeContainerHandlers, UseNodeInteractionOptions } from 'types/node'
import { useActiveTool, useInstance, useWhiteboardConfig } from '../../common/hooks'
import { useGroupRuntime } from './useGroupRuntime'
import { useSnapRuntime } from './useSnapRuntime'
import { useNodeTransient } from './useNodeTransient'
import { useNodeDrag } from './useNodeDrag'
import { getSelectionModeFromEvent } from '../utils/selection'


export const useNodeInteraction = ({ node }: UseNodeInteractionOptions) => {
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const activeTool = useActiveTool()
  const groupRuntime = useGroupRuntime()
  const snapRuntime = useSnapRuntime()
  const transientRuntime = useNodeTransient()

  const size = useMemo(
    () => ({
      width: node.size?.width ?? nodeSize.width,
      height: node.size?.height ?? nodeSize.height
    }),
    [node.size?.height, node.size?.width, nodeSize.height, nodeSize.width]
  )

  const dragHandlers = useNodeDrag({
    core: instance.core,
    nodeId: node.id,
    nodeType: node.type,
    position: node.position,
    size,
    getZoom: instance.viewport.getZoom,
    snap: snapRuntime,
    group: groupRuntime,
    transient: transientRuntime
  })

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activeTool === 'edge') {
        const container = instance.containerRef.current
        const screenToWorld = instance.viewport.screenToWorld
        if (!container || !screenToWorld) return
        const rect = container.getBoundingClientRect()
        const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        const worldPoint = screenToWorld(screenPoint)
        const handled = instance.api.edgeConnect.handleNodePointerDown(node.id, worldPoint, event.pointerId)
        if (!handled) return
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (event.button === 0) {
        const mode = getSelectionModeFromEvent(event.nativeEvent)
        if (mode === 'toggle') {
          instance.api.selection.toggle([node.id])
        } else {
          instance.api.selection.select([node.id], mode)
        }
      }

      dragHandlers.onPointerDown(event)
    },
    [activeTool, dragHandlers, instance, node.id]
  )

  const handleEdgeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => {
      event.preventDefault()
      event.stopPropagation()
      instance.api.edgeConnect.startFromHandle(node.id, side, event.pointerId)
    },
    [instance, node.id]
  )

  const handlePointerEnter = useCallback(() => {
    instance.api.interaction.update({ hover: { nodeId: node.id } })
  }, [instance, node.id])

  const handlePointerLeave = useCallback(() => {
    instance.api.interaction.update({ hover: { nodeId: undefined } })
  }, [instance])

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
