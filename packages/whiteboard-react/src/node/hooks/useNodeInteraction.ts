import { useCallback } from 'react'
import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { PointerEvent } from 'react'
import type { Size } from '../../common/types'
import { useNodeDrag } from './useNodeDrag'
import type { UseSelectionReturn } from './useSelection'
import type { UseEdgeConnectReturn } from '../../edge/hooks'
import type { Guide, SnapCandidate } from '../utils/snap'
import type { NodeTransientApi } from './useNodeViewState'

type Options = {
  node: Node
  core: Core
  rect: Rect
  zoom: number
  selection?: UseSelectionReturn
  edgeConnect?: UseEdgeConnectReturn
  tool?: 'select' | 'edge'
  group?: {
    nodes: Node[]
    nodeSize: Size
    padding?: number
    hoveredGroupId?: NodeId
    onHoverGroupChange?: (groupId?: NodeId) => void
  }
  snap?: {
    enabled: boolean
    candidates: SnapCandidate[]
    getCandidates?: (rect: Rect) => SnapCandidate[]
    thresholdScreen: number
    zoom: number
    onGuidesChange?: (guides: Guide[]) => void
  }
  transient?: NodeTransientApi
}

export const useNodeInteraction = ({
  node,
  core,
  rect,
  zoom,
  selection,
  edgeConnect,
  tool,
  group,
  snap,
  transient
}: Options) => {
  const dragHandlers = useNodeDrag(
    core,
    node.id,
    node.position,
    { width: rect.width, height: rect.height },
    zoom,
    snap,
    group,
    transient
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (tool === 'edge' && edgeConnect) {
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
      if (event.button === 0 && selection) {
        const mode = selection.getClickModeFromEvent(event)
        if (mode === 'toggle') {
          selection.toggle([node.id])
        } else {
          selection.select([node.id], mode)
        }
      }
      dragHandlers.onPointerDown(event)
    },
    [dragHandlers, edgeConnect, node.id, selection, tool]
  )

  const handleEdgeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, side: 'top' | 'right' | 'bottom' | 'left') => {
      event.preventDefault()
      event.stopPropagation()
      edgeConnect?.startFromHandle(node.id, side, event.pointerId)
    },
    [edgeConnect, node.id]
  )

  return {
    dragHandlers,
    handlePointerDown,
    handleEdgeHandlePointerDown
  }
}
