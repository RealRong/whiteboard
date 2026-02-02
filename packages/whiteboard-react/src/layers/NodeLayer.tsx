import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { PointerEvent, RefObject } from 'react'
import { useMemo } from 'react'
import type { MindmapLayoutConfig, Size } from '../types'
import { NodeBlock } from '../components/NodeBlock'
import { getNodeRect } from '../utils/geometry'
import { useNodeDrag } from '../hooks/useNodeDrag'
import { useNodeTransform } from '../hooks/useNodeTransform'
import type { UseSelectionReturn } from '../hooks/useSelection'
import type { UseEdgeConnectReturn } from '../hooks/useEdgeConnect'
import type { Guide, SnapCandidate } from '../utils/snap'
import { renderNodeDefinition, getNodeDefinitionStyle } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry/nodeRegistry'
import { MindmapLayer } from './MindmapLayer'

type NodeItemProps = {
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

const NodeItem = ({
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
  snap
}: NodeItemProps) => {
  const registry = useNodeRegistry()
  const definition = registry.get(node.type)
  const rect = getNodeRect(node, fallbackSize)
  const dragHandlers = useNodeDrag(
    core,
    node.id,
    node.position,
    { width: rect.width, height: rect.height },
    zoom,
    snap,
    group
  )
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'
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
  const selected = selection?.isSelected(node.id) ?? false
  const hoveredGroup = group?.hoveredGroupId === node.id
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
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
  }
  const nodeStyle = getNodeDefinitionStyle(definition, {
    core,
    node,
    rect,
    selected,
    hovered: hoveredGroup,
    zoom
  })
  const rotationStyle =
    typeof node.rotation === 'number' && node.rotation !== 0
      ? {
          transform: `rotate(${node.rotation}deg)`,
          transformOrigin: 'center center'
        }
      : undefined
  const containerProps = {
    rect,
    nodeId: node.id,
    selected,
    style: { ...nodeStyle, ...rotationStyle, pointerEvents: 'auto' },
    onPointerDown: handlePointerDown,
    onPointerMove: dragHandlers.onPointerMove,
    onPointerUp: dragHandlers.onPointerUp
  }
  const renderProps = {
    core,
    node,
    rect,
    selected,
    hovered: hoveredGroup,
    zoom,
    containerProps
  }
  const content = renderNodeDefinition(definition, renderProps)
  return (
    <>
      {definition?.renderContainer ? (
        definition.renderContainer(renderProps, content)
      ) : (
        <NodeBlock
          rect={rect}
          label={content}
          nodeId={node.id}
          selected={selected}
          showHandles={false}
          style={containerProps.style}
          onHandlePointerDown={(event, side) => {
            event.preventDefault()
            event.stopPropagation()
            edgeConnect?.startFromHandle(node.id, side, event.pointerId)
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={dragHandlers.onPointerMove}
          onPointerUp={dragHandlers.onPointerUp}
        />
      )}
      {transform.renderHandles()}
    </>
  )
}

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
