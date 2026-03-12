import {
  computeSnap,
  expandGroupRect,
  expandRectByThreshold,
  findSmallestGroupAtPoint,
  getGroupDescendants,
  getNodesBoundingRect,
  rectEquals,
  resolveSnapThresholdWorld,
  resolveInteractionZoom,
  type Guide,
  type SnapCandidate
} from '@whiteboard/core/node'
import {
  getNodeAABB,
  isPointEqual,
  isSizeEqual,
  rectContains
} from '@whiteboard/core/geometry'
import type { InstanceConfig } from '@whiteboard/engine'
import type { Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core/types'

export type GroupChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}

export type NodeDragRuntimeState = {
  nodeId: NodeId
  nodeType: Node['type']
  start: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  children?: GroupChildren
  hoveredGroupId?: NodeId
}

export type NodeDragPositionUpdate = {
  id: NodeId
  position: Point
}

export type NodeDragPreviewResult = {
  position: Point
  guides: readonly Guide[]
  hoveredGroupId?: NodeId
  patches: NodeDragPositionUpdate[]
}

const SNAP_CROSS_THRESHOLD_RATIO = 0.6
const GROUP_RECT_EPSILON = 0.5

const toNodeById = (nodes: readonly Node[]) =>
  new Map(nodes.map((node) => [node.id, node]))

const hasParentIdPatch = (
  patch: NodePatch
): patch is NodePatch & { parentId: NodeId | undefined } =>
  Object.prototype.hasOwnProperty.call(patch, 'parentId')

const mergePatch = (
  patches: Map<NodeId, NodePatch>,
  id: NodeId,
  patch: NodePatch
) => {
  if (!Object.keys(patch).length) return
  const prev = patches.get(id)
  patches.set(id, prev ? { ...prev, ...patch } : { ...patch })
}

const normalizePatch = (
  currentNode: Node,
  patch: NodePatch
): NodePatch | undefined => {
  const normalized: NodePatch = {}

  if (patch.position && !isPointEqual(patch.position, currentNode.position)) {
    normalized.position = patch.position
  }
  if (patch.size && !isSizeEqual(patch.size, currentNode.size)) {
    normalized.size = patch.size
  }
  if (hasParentIdPatch(patch) && patch.parentId !== currentNode.parentId) {
    normalized.parentId = patch.parentId
  }

  return Object.keys(normalized).length ? normalized : undefined
}

export const buildGroupChildren = (
  nodes: readonly Node[],
  nodeId: NodeId,
  origin: Point
): GroupChildren | undefined => {
  const ids = getGroupDescendants(nodes, nodeId).map((child) => child.id)
  if (!ids.length) return undefined

  const nodeById = toNodeById(nodes)
  const offsets = new Map<NodeId, Point>()
  ids.forEach((childId) => {
    const childNode = nodeById.get(childId)
    if (!childNode) return
    offsets.set(childId, {
      x: childNode.position.x - origin.x,
      y: childNode.position.y - origin.y
    })
  })

  return {
    ids,
    offsets
  }
}

export const buildGroupUpdates = (
  draft: Pick<NodeDragRuntimeState, 'children' | 'nodeId'>,
  position: Point
): NodeDragPositionUpdate[] => {
  const updates: NodeDragPositionUpdate[] = [{
    id: draft.nodeId,
    position
  }]

  draft.children?.ids.forEach((childId) => {
    const offset = draft.children?.offsets.get(childId)
    if (!offset) return
    updates.push({
      id: childId,
      position: {
        x: position.x + offset.x,
        y: position.y + offset.y
      }
    })
  })

  return updates
}

export const resolveNodeDragPreview = (options: {
  active: NodeDragRuntimeState
  client: Point
  zoom: number
  snapEnabled: boolean
  allowCross: boolean
  nodes: readonly Node[]
  config: Pick<InstanceConfig, 'node' | 'nodeSize'>
  readSnapCandidatesInRect: (rect: Rect) => readonly SnapCandidate[]
}): NodeDragPreviewResult => {
  const {
    active,
    client,
    zoom,
    snapEnabled,
    allowCross,
    nodes,
    config,
    readSnapCandidatesInRect
  } = options
  const safeZoom = resolveInteractionZoom(zoom)
  const basePosition = {
    x: active.origin.x + (client.x - active.start.x) / safeZoom,
    y: active.origin.y + (client.y - active.start.y) / safeZoom
  }

  let position = basePosition
  let guides: readonly Guide[] = []

  if (snapEnabled) {
    const thresholdWorld = resolveSnapThresholdWorld(config.node, safeZoom)
    const movingRect: Rect = {
      x: basePosition.x,
      y: basePosition.y,
      width: active.size.width,
      height: active.size.height
    }
    const queryRect = expandRectByThreshold(movingRect, thresholdWorld)
    const exclude = active.children?.ids.length
      ? new Set([active.nodeId, ...active.children.ids])
      : new Set([active.nodeId])
    const candidates = readSnapCandidatesInRect(queryRect)
      .filter((candidate) => !exclude.has(candidate.id as NodeId))
    const snapResult = computeSnap(
      movingRect,
      candidates,
      thresholdWorld,
      active.nodeId,
      {
        allowCross,
        crossThreshold: thresholdWorld * SNAP_CROSS_THRESHOLD_RATIO
      }
    )
    guides = snapResult.guides
    position = {
      x:
        snapResult.dx !== undefined
          ? basePosition.x + snapResult.dx
          : basePosition.x,
      y:
        snapResult.dy !== undefined
          ? basePosition.y + snapResult.dy
          : basePosition.y
    }
  }

  const hoveredGroupId = active.children
    ? undefined
    : findSmallestGroupAtPoint(
      [...nodes],
      config.nodeSize,
      {
        x: position.x + active.size.width / 2,
        y: position.y + active.size.height / 2
      },
      active.nodeId
    )?.id

  return {
    position,
    guides,
    hoveredGroupId,
    patches: active.children
      ? buildGroupUpdates(active, position)
      : [{
        id: active.nodeId,
        position
      }]
  }
}

export const resolveNodeDragCommit = (options: {
  draft: NodeDragRuntimeState
  nodes: readonly Node[]
  config: Pick<InstanceConfig, 'node' | 'nodeSize'>
}): Array<{ id: NodeId; patch: NodePatch }> => {
  const { draft, nodes, config } = options
  const nodeById = toNodeById(nodes)
  const currentNode = nodeById.get(draft.nodeId)
  if (!currentNode) return []

  const updates = draft.children
    ? buildGroupUpdates(draft, draft.last)
    : [{
      id: draft.nodeId,
      position: draft.last
    }]

  const patches = new Map<NodeId, NodePatch>()
  updates.forEach((update) => {
    mergePatch(patches, update.id, {
      position: update.position
    })
  })

  if (!draft.children && draft.nodeType !== 'group') {
    const parentId = currentNode.parentId
    const hoveredGroupId = draft.hoveredGroupId

    if (hoveredGroupId && hoveredGroupId !== parentId) {
      const hoveredGroup = nodeById.get(hoveredGroupId)
      if (hoveredGroup) {
        mergePatch(patches, draft.nodeId, {
          parentId: hoveredGroup.id
        })
        const groupRect = getNodeAABB(hoveredGroup, config.nodeSize)
        const children = getGroupDescendants(nodes, hoveredGroup.id)
        const virtualNode: Node = {
          ...currentNode,
          position: draft.last
        }
        const contentRect = getNodesBoundingRect(
          [...children, virtualNode],
          config.nodeSize
        )
        if (contentRect) {
          const padding =
            hoveredGroup.data && typeof hoveredGroup.data.padding === 'number'
              ? hoveredGroup.data.padding
              : config.node.groupPadding
          const expanded = expandGroupRect(groupRect, contentRect, padding)
          if (!rectEquals(expanded, groupRect, GROUP_RECT_EPSILON)) {
            mergePatch(patches, hoveredGroup.id, {
              position: {
                x: expanded.x,
                y: expanded.y
              },
              size: {
                width: expanded.width,
                height: expanded.height
              }
            })
          }
        }
      }
    } else if (!hoveredGroupId && parentId) {
      const parentNode = nodeById.get(parentId)
      if (parentNode) {
        const parentRect = getNodeAABB(parentNode, config.nodeSize)
        const nodeRect = {
          x: draft.last.x,
          y: draft.last.y,
          width: draft.size.width,
          height: draft.size.height
        }
        if (!rectContains(parentRect, nodeRect)) {
          mergePatch(patches, draft.nodeId, {
            parentId: undefined
          })
        }
      }
    }
  }

  const normalizedUpdates: Array<{ id: NodeId; patch: NodePatch }> = []
  patches.forEach((patch, id) => {
    const current = nodeById.get(id)
    if (!current) return
    const normalized = normalizePatch(current, patch)
    if (!normalized) return
    normalizedUpdates.push({
      id,
      patch: normalized
    })
  })

  return normalizedUpdates
}
