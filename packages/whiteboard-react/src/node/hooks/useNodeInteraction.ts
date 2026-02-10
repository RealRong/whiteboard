import { useCallback, useMemo } from 'react'
import type { PointerEvent } from 'react'
import type { NodeHandleSide, NodeContainerHandlers, UseNodeInteractionOptions } from 'types/node'
import { useActiveTool, useInstance } from '../../common/hooks'
import { useNodeDrag } from './useNodeDrag'
import { getSelectionModeFromEvent } from '../utils/selection'


export const useNodeInteraction = ({ node }: UseNodeInteractionOptions) => {
  const instance = useInstance()
  const activeTool = useActiveTool()
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const dragHandlers = useNodeDrag({ node })

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activeTool === 'edge') {
        const worldPoint = screenToWorld(clientToScreen(event.clientX, event.clientY))
        const handled = instance.commands.edgeConnect.handleNodePointerDown(node.id, worldPoint, event.pointerId)
        if (!handled) return
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (event.button === 0) {
        const mode = getSelectionModeFromEvent(event.nativeEvent)
        if (mode === 'toggle') {
          instance.commands.selection.toggle([node.id])
        } else {
          instance.commands.selection.select([node.id], mode)
        }
      }

      dragHandlers.onPointerDown(event)
    },
    [activeTool, clientToScreen, dragHandlers, instance, node.id, screenToWorld]
  )

  const handleEdgeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => {
      event.preventDefault()
      event.stopPropagation()
      instance.commands.edgeConnect.startFromHandle(node.id, side, event.pointerId)
    },
    [instance, node.id]
  )

  const handlePointerEnter = useCallback(() => {
    instance.commands.interaction.update({ hover: { nodeId: node.id } })
  }, [instance, node.id])

  const handlePointerLeave = useCallback(() => {
    instance.commands.interaction.update({ hover: { nodeId: undefined } })
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
