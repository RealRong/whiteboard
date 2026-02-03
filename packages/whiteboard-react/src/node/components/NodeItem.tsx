import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { Size } from '../../common/types'
import type { UseSelectionReturn } from '../hooks/useSelection'
import type { UseEdgeConnectReturn } from '../../edge/hooks/useEdgeConnect'
import type { Guide, SnapCandidate } from '../utils/snap'
import { NodeBlock } from './NodeBlock'
import { useNodeItem } from '../hooks/useNodeItem'

export type NodeItemProps = {
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
}

export const NodeItem = (props: NodeItemProps) => {
  const { definition, rect, selected, renderProps, content, containerProps, transform, handleEdgeHandlePointerDown } =
    useNodeItem({
      node: props.node,
      core: props.core,
      fallbackSize: props.fallbackSize,
      zoom: props.zoom,
      selection: props.selection,
      edgeConnect: props.edgeConnect,
      tool: props.tool,
      containerRef: props.containerRef,
      screenToWorld: props.screenToWorld,
      group: props.group,
      snap: props.snap
    })

  return (
    <>
      {definition?.renderContainer ? (
        definition.renderContainer(renderProps, content)
      ) : (
        <NodeBlock
          rect={rect}
          label={content}
          nodeId={props.node.id}
          selected={selected}
          showHandles={false}
          style={containerProps.style}
          onHandlePointerDown={handleEdgeHandlePointerDown}
          onPointerDown={containerProps.onPointerDown}
          onPointerMove={containerProps.onPointerMove}
          onPointerUp={containerProps.onPointerUp}
        />
      )}
      {transform.renderHandles()}
    </>
  )
}
