import {
  computeSubtreeDropTarget,
  getSubtreeIds,
  type MindmapDragDropTarget
} from '@whiteboard/core/mindmap'
import type { MindmapItem } from '@whiteboard/core/read'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { MindmapDragDraft } from '../../../../runtime/draft'

export type RootDragSession = {
  kind: 'root'
  treeId: NodeId
  pointerId: number
  start: Point
  origin: Point
  position: Point
}

export type SubtreeDragSession = {
  kind: 'subtree'
  treeId: NodeId
  pointerId: number
  nodeId: MindmapNodeId
  originParentId?: MindmapNodeId
  originIndex?: number
  baseOffset: Point
  offset: Point
  rect: Rect
  ghost: Rect
  excludeIds: MindmapNodeId[]
  layout: MindmapItem['layout']
  drop?: MindmapDragDropTarget
}

export type MindmapDragSession = RootDragSession | SubtreeDragSession

export const toDragDraft = (session: MindmapDragSession): MindmapDragDraft => {
  if (session.kind === 'root') {
    return {
      treeId: session.treeId,
      kind: 'root',
      baseOffset: session.position
    }
  }

  return {
    treeId: session.treeId,
    kind: 'subtree',
    baseOffset: session.baseOffset,
    preview: {
      nodeId: session.nodeId,
      ghost: session.ghost,
      drop: session.drop
    }
  }
}

const buildNodeRectMap = (
  item: MindmapItem,
  baseOffset: Point
) => {
  const rectMap = new Map<MindmapNodeId, Rect>()
  Object.entries(item.computed.node).forEach(([id, rect]) => {
    if (!rect) return
    rectMap.set(id as MindmapNodeId, {
      x: rect.x + item.shiftX + baseOffset.x,
      y: rect.y + item.shiftY + baseOffset.y,
      width: rect.width,
      height: rect.height
    })
  })
  return rectMap
}

const buildGhostRect = (
  pointerWorld: Point,
  pointerOffset: Point,
  nodeRect: Rect
): Rect => ({
  x: pointerWorld.x - pointerOffset.x,
  y: pointerWorld.y - pointerOffset.y,
  width: nodeRect.width,
  height: nodeRect.height
})

export const resolveRootDragSession = (options: {
  treeId: NodeId
  pointerId: number
  start: Point
  origin: Point
}): RootDragSession => ({
  kind: 'root',
  treeId: options.treeId,
  pointerId: options.pointerId,
  start: options.start,
  origin: options.origin,
  position: options.origin
})

export const resolveSubtreeDragSession = (options: {
  treeId: NodeId
  treeView: MindmapItem
  nodeId: MindmapNodeId
  pointerId: number
  world: Point
  baseOffset: Point
}): SubtreeDragSession | undefined => {
  const {
    treeId,
    treeView,
    nodeId,
    pointerId,
    world,
    baseOffset
  } = options
  const nodeRects = buildNodeRectMap(treeView, baseOffset)
  const rect = nodeRects.get(nodeId)
  if (!rect) return undefined

  const originParentId = treeView.tree.nodes[nodeId]?.parentId
  const originIndex =
    originParentId !== undefined
      ? (treeView.tree.children[originParentId] ?? []).indexOf(nodeId)
      : undefined

  return {
    kind: 'subtree',
    treeId,
    pointerId,
    nodeId,
    originParentId,
    originIndex,
    baseOffset,
    offset: {
      x: world.x - rect.x,
      y: world.y - rect.y
    },
    rect,
    ghost: rect,
    excludeIds: getSubtreeIds(treeView.tree, nodeId),
    layout: treeView.layout
  }
}

const resolveRootDragPosition = (
  active: RootDragSession,
  world: Point
): Point => ({
  x: active.origin.x + (world.x - active.start.x),
  y: active.origin.y + (world.y - active.start.y)
})

const resolveSubtreeDropTarget = (
  active: SubtreeDragSession,
  treeView: MindmapItem | undefined,
  ghost: Rect
) => (
  treeView
    ? computeSubtreeDropTarget({
      tree: treeView.tree,
      nodeRects: buildNodeRectMap(treeView, active.baseOffset),
      ghost,
      dragNodeId: active.nodeId,
      dragExcludeIds: new Set(active.excludeIds),
      layoutOptions: treeView.layout.options
    })
    : active.drop
)

export const resolveNextMindmapDragSession = (options: {
  active: MindmapDragSession
  world: Point
  treeView?: MindmapItem
}): MindmapDragSession => {
  const {
    active,
    world,
    treeView
  } = options

  if (active.kind === 'root') {
    return {
      ...active,
      position: resolveRootDragPosition(active, world)
    }
  }

  const ghost = buildGhostRect(world, active.offset, active.rect)
  const drop = resolveSubtreeDropTarget(active, treeView, ghost)

  return {
    ...active,
    ghost,
    drop,
    layout: treeView?.layout ?? active.layout
  }
}
