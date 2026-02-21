import type { Query } from '@engine-types/instance/query'
import type { NodeTransformHandle, NodeViewItem } from '@engine-types/instance/view'
import type { Node, NodeId, Rect } from '@whiteboard/core'
import { DEFAULT_TUNING } from '../../../../config'
import { buildTransformHandles } from '../domain'

export type NodeViewContext = {
  activeTool: 'select' | 'edge'
  selectedNodeIds: Set<NodeId>
  hoveredGroupId: NodeId | undefined
  zoom: number
}

const getNodeRect = (query: Query, node: Node): Rect =>
  query.canvas.nodeRect(node.id)?.rect ?? {
    x: node.position.x,
    y: node.position.y,
    width: node.size?.width ?? 0,
    height: node.size?.height ?? 0
  }

const isSameHandleList = (
  left: NodeTransformHandle[] | undefined,
  right: NodeTransformHandle[]
) => {
  if (!left) return false
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const leftHandle = left[index]
    const rightHandle = right[index]
    if (
      leftHandle.id !== rightHandle.id ||
      leftHandle.kind !== rightHandle.kind ||
      leftHandle.direction !== rightHandle.direction ||
      leftHandle.cursor !== rightHandle.cursor ||
      leftHandle.position.x !== rightHandle.position.x ||
      leftHandle.position.y !== rightHandle.position.y
    ) {
      return false
    }
  }
  return true
}

export const projectNodeItem = (options: {
  node: Node
  query: Query
  context: NodeViewContext
  previous?: NodeViewItem
}): NodeViewItem => {
  const { node, query, context, previous } = options
  const rect = getNodeRect(query, node)
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  const transformBase = `translate(${rect.x}px, ${rect.y}px)`
  const selected =
    context.activeTool === 'edge'
      ? false
      : context.selectedNodeIds.has(node.id)
  const hovered = context.hoveredGroupId === node.id

  if (
    previous &&
    previous.node === node &&
    previous.rect === rect &&
    previous.container.rotation === rotation &&
    previous.container.transformBase === transformBase &&
    previous.selected === selected &&
    previous.hovered === hovered &&
    previous.activeTool === context.activeTool &&
    previous.zoom === context.zoom
  ) {
    return previous
  }

  return {
    node,
    rect,
    container: {
      transformBase,
      rotation,
      transformOrigin: 'center center'
    },
    selected,
    hovered,
    activeTool: context.activeTool,
    zoom: context.zoom
  }
}

export const projectNodeHandles = (options: {
  node: Node
  query: Query
  context: NodeViewContext
  previous?: NodeTransformHandle[]
}): NodeTransformHandle[] | undefined => {
  const { node, query, context, previous } = options
  if (context.activeTool !== 'select') return undefined
  if (!context.selectedNodeIds.has(node.id) || node.locked) return undefined

  const rect = getNodeRect(query, node)
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  const next = buildTransformHandles({
    rect,
    rotation,
    canRotate: true,
    rotateHandleOffset: DEFAULT_TUNING.nodeTransform.rotateHandleOffset,
    zoom: context.zoom
  })
  if (isSameHandleList(previous, next)) {
    return previous
  }
  return next
}

