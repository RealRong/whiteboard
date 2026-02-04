import { useMemo } from 'react'
import type { Core, Node, NodeId, Rect, Point } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { Size } from '../../common/types'
import type { MindmapLayoutConfig } from '../../mindmap/types'
import type { UseSelectionReturn } from './useSelection'
import type { UseEdgeConnectReturn } from '../../edge/hooks/useEdgeConnect'
import type { Guide, SnapCandidate } from '../utils/snap'
import type { NodeTransientApi } from './useNodeViewState'

type Options = {
  nodes: Node[]
  core: Core
  nodeSize: Size
  zoom: number
  selection: UseSelectionReturn
  edgeConnect: UseEdgeConnectReturn
  tool: 'select' | 'edge'
  containerRef?: RefObject<HTMLElement>
  screenToWorld?: (point: Point) => Point
  group: {
    nodes: Node[]
    nodeSize: Size
    padding?: number
    hoveredGroupId?: NodeId
    onHoverGroupChange?: (groupId?: NodeId) => void
  }
  mindmap: {
    nodes: Node[]
    nodeSize: Size
    layout: MindmapLayoutConfig
    core: Core
    screenToWorld: (point: Point) => Point
    containerRef?: RefObject<HTMLElement>
  }
  snap: {
    enabled: boolean
    candidates: SnapCandidate[]
    getCandidates?: (rect: Rect) => SnapCandidate[]
    thresholdScreen: number
    zoom: number
    onGuidesChange?: (guides: Guide[]) => void
  }
  transient: NodeTransientApi
}

export const useNodeLayerModel = ({
  nodes,
  core,
  nodeSize,
  zoom,
  selection,
  edgeConnect,
  tool,
  containerRef,
  screenToWorld,
  group,
  mindmap,
  snap,
  transient
}: Options) => {
  const nodeLayerProps = useMemo(
    () => ({
      nodes,
      core,
      nodeSize,
      zoom,
      selection: tool === 'edge' ? undefined : selection,
      edgeConnect,
      tool,
      containerRef,
      screenToWorld,
      group,
      mindmap,
      snap,
      transient
    }),
    [
      containerRef,
      core,
      edgeConnect,
      group,
      mindmap,
      nodeSize,
      nodes,
      screenToWorld,
      selection,
      snap,
      tool,
      transient,
      zoom
    ]
  )

  const selectionRect = tool === 'edge' ? undefined : selection.selectionRect

  return { nodeLayerProps, selectionRect }
}
