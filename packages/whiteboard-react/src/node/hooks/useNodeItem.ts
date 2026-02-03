import { useMemo } from 'react'
import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { Size } from '../../common/types'
import { getNodeRect } from '../../common/utils/geometry'
import { useNodeTransform } from './useNodeTransform'
import type { UseSelectionReturn } from './useSelection'
import type { UseEdgeConnectReturn } from '../../edge/hooks/useEdgeConnect'
import type { Guide, SnapCandidate } from '../utils/snap'
import { useNodeRegistry } from '../registry/nodeRegistry'
import { useNodeInteraction } from './useNodeInteraction'
import { useNodeStyle } from './useNodeStyle'
import { useNodeRenderModel } from './useNodeRenderModel'
import type { NodeTransientApi } from './useNodeViewState'

export type UseNodeItemOptions = {
  node: Node
  core: Core
  fallbackSize: Size
  zoom: number
  selection?: UseSelectionReturn
  edgeConnect?: UseEdgeConnectReturn
  tool?: 'select' | 'edge'
  containerRef?: RefObject<HTMLElement>
  screenToWorld?: (point: Point) => Point
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

export const useNodeItem = ({
  node,
  core,
  fallbackSize,
  zoom,
  selection,
  edgeConnect,
  tool,
  containerRef,
  screenToWorld,
  group,
  snap,
  transient
}: UseNodeItemOptions) => {
  const registry = useNodeRegistry()
  const definition = registry.get(node.type)
  const rect = useMemo(() => getNodeRect(node, fallbackSize), [node, fallbackSize])
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'
  const selected = selection?.isSelected(node.id) ?? false
  const hoveredGroup = group?.hoveredGroupId === node.id
  const { dragHandlers, handlePointerDown, handleEdgeHandlePointerDown } = useNodeInteraction({
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
  })
  const { nodeStyle, rotationStyle } = useNodeStyle({
    core,
    node,
    rect,
    selected,
    hovered: hoveredGroup,
    zoom,
    definition
  })
  const transform = useNodeTransform({
    core,
    node,
    nodeSize: fallbackSize,
    zoom,
    containerRef,
    screenToWorld,
    enabled: (selection?.isSelected(node.id) ?? false) && tool === 'select',
    canRotate,
    snap
  })
  const { containerProps, renderProps, content } = useNodeRenderModel({
    core,
    node,
    rect,
    selected,
    hovered: hoveredGroup,
    zoom,
    definition,
    nodeStyle,
    rotationStyle,
    dragHandlers,
    handlePointerDown
  })

  return {
    definition,
    rect,
    selected,
    renderProps,
    content,
    containerProps,
    transform,
    handlePointerDown,
    handleEdgeHandlePointerDown
  }
}
