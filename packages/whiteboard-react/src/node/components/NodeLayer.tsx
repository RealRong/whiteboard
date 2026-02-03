import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { RefObject } from 'react'
import { useMemo } from 'react'
import type { MindmapLayoutConfig } from '../../mindmap/types'
import type { Size } from '../../common/types'
import type { UseSelectionReturn } from '../hooks/useSelection'
import type { UseEdgeConnectReturn } from '../../edge/hooks/useEdgeConnect'
import type { Guide, SnapCandidate } from '../utils/snap'
import { MindmapLayer } from '../../mindmap/components/MindmapLayer'
import { NodeItem } from './NodeItem'

type NodeLayerProps = {
  nodes: Node[]
  core: Core
  nodeSize: Size
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
  mindmap?: {
    nodes: Node[]
    nodeSize: Size
    layout: MindmapLayoutConfig
    core: Core
    screenToWorld: (point: Point) => Point
    containerRef?: RefObject<HTMLElement>
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

export const NodeLayer = ({
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
  snap
}: NodeLayerProps) => {
  const orderedNodes = useMemo(() => {
    const groups: Node[] = []
    const rest: Node[] = []
    nodes.forEach((node) => {
      if (node.type === 'group') {
        groups.push(node)
      } else {
        rest.push(node)
      }
    })
    return [...groups, ...rest]
  }, [nodes])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {mindmap ? (
        <MindmapLayer
          nodes={mindmap.nodes}
          nodeSize={mindmap.nodeSize}
          layout={mindmap.layout}
          core={mindmap.core}
          screenToWorld={mindmap.screenToWorld}
          containerRef={mindmap.containerRef}
        />
      ) : null}
      {orderedNodes.map((node) => (
        <NodeItem
          key={node.id}
          node={node}
          core={core}
          fallbackSize={nodeSize}
          zoom={zoom}
          selection={selection}
          edgeConnect={edgeConnect}
          tool={tool}
          containerRef={containerRef}
          screenToWorld={screenToWorld}
          group={group}
          snap={snap}
        />
      ))}
    </div>
  )
}
