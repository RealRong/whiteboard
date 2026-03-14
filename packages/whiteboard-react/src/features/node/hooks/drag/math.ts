import {
  computeSnap,
  expandContainerRect,
  expandRectByThreshold,
  findSmallestContainerAtPoint,
  getContainerDescendants,
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

export type DragMember = {
  id: NodeId
  offset: Point
}

export type NodeDragRuntimeState = {
  anchorId: NodeId
  anchorType: Node['type']
  members: DragMember[]
  start: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  hoveredContainerId?: NodeId
}

export type NodeDragPositionUpdate = {
  id: NodeId
  position: Point
}

export type NodeDragPreviewResult = {
  position: Point
  guides: readonly Guide[]
  hoveredContainerId?: NodeId
  patches: NodeDragPositionUpdate[]
}

const SNAP_CROSS_THRESHOLD_RATIO = 0.6
const GROUP_RECT_EPSILON = 0.5

const toNodeById = (nodes: readonly Node[]) =>
  new Map(nodes.map((node) => [node.id, node]))

const hasSelectedAncestor = (
  node: Node,
  selectedNodeIds: ReadonlySet<NodeId>,
  nodeById: ReadonlyMap<NodeId, Node>
) => {
  let parentId = node.parentId
  while (parentId) {
    if (selectedNodeIds.has(parentId)) {
      return true
    }
    parentId = nodeById.get(parentId)?.parentId
  }
  return false
}

const getDragRootIds = (
  nodes: readonly Node[],
  anchorId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => {
  const nodeById = toNodeById(nodes)
  const effectiveSelectedNodeIds = selectedNodeIds.includes(anchorId)
    ? selectedNodeIds
    : [anchorId]
  const selectedSet = new Set(effectiveSelectedNodeIds)

  return effectiveSelectedNodeIds.filter((nodeId) => {
    const node = nodeById.get(nodeId)
    if (!node) return false
    return !hasSelectedAncestor(node, selectedSet, nodeById)
  })
}

const appendDragMembers = (
  members: DragMember[],
  memberIds: Set<NodeId>,
  anchor: Point,
  node: Node
) => {
  if (memberIds.has(node.id)) return

  memberIds.add(node.id)
  members.push({
    id: node.id,
    offset: {
      x: node.position.x - anchor.x,
      y: node.position.y - anchor.y
    }
  })
}

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

export const buildNodeDragState = (options: {
  nodes: readonly Node[],
  anchorId: NodeId
  anchorType: Node['type']
  start: Point
  origin: Point
  size: {
    width: number
    height: number
  }
  selectedNodeIds: readonly NodeId[]
}): NodeDragRuntimeState => {
  const {
    nodes,
    anchorId,
    anchorType,
    start,
    origin,
    size,
    selectedNodeIds
  } = options
  const nodeById = toNodeById(nodes)
  const rootIds = getDragRootIds(nodes, anchorId, selectedNodeIds)
  const members: DragMember[] = []
  const memberIds = new Set<NodeId>()

  rootIds.forEach((rootId) => {
    const root = nodeById.get(rootId)
    if (!root) return
    appendDragMembers(members, memberIds, origin, root)
    if (root.type !== 'group') return
    getContainerDescendants(nodes, root.id).forEach((child) => {
      appendDragMembers(members, memberIds, origin, child)
    })
  })

  return {
    anchorId,
    anchorType,
    members,
    start,
    origin,
    last: origin,
    size
  }
}

const buildPositionUpdates = (
  members: readonly DragMember[],
  anchorPosition: Point
): NodeDragPositionUpdate[] => (
  members.map((member) => ({
    id: member.id,
    position: {
      x: anchorPosition.x + member.offset.x,
      y: anchorPosition.y + member.offset.y
    }
  }))
)

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
    const exclude = new Set(active.members.map((member) => member.id))
    const candidates = readSnapCandidatesInRect(queryRect)
      .filter((candidate) => !exclude.has(candidate.id as NodeId))
    const snapResult = computeSnap(
      movingRect,
      candidates,
      thresholdWorld,
      active.anchorId,
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

  const hoveredContainerId =
    active.members.length === 1 && active.anchorType !== 'group'
      ? findSmallestContainerAtPoint(
        [...nodes],
        config.nodeSize,
        {
          x: position.x + active.size.width / 2,
          y: position.y + active.size.height / 2
        },
        active.anchorId
      )?.id
      : undefined

  return {
    position,
    guides,
    hoveredContainerId,
    patches: buildPositionUpdates(active.members, position)
  }
}

export const resolveNodeDragCommit = (options: {
  draft: NodeDragRuntimeState
  nodes: readonly Node[]
  config: Pick<InstanceConfig, 'node' | 'nodeSize'>
}): Array<{ id: NodeId; patch: NodePatch }> => {
  const { draft, nodes, config } = options
  const nodeById = toNodeById(nodes)
  const currentNode = nodeById.get(draft.anchorId)
  if (!currentNode) return []

  const updates = buildPositionUpdates(draft.members, draft.last)

  const patches = new Map<NodeId, NodePatch>()
  updates.forEach((update) => {
    mergePatch(patches, update.id, {
      position: update.position
    })
  })

  if (draft.members.length === 1 && draft.anchorType !== 'group') {
    const parentId = currentNode.parentId
    const hoveredContainerId = draft.hoveredContainerId

    if (hoveredContainerId && hoveredContainerId !== parentId) {
      const hoveredGroup = nodeById.get(hoveredContainerId)
      if (hoveredGroup) {
        mergePatch(patches, draft.anchorId, {
          parentId: hoveredGroup.id
        })
        const groupRect = getNodeAABB(hoveredGroup, config.nodeSize)
        const children = getContainerDescendants(nodes, hoveredGroup.id)
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
          const expanded = expandContainerRect(groupRect, contentRect, padding)
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
    } else if (!hoveredContainerId && parentId) {
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
          mergePatch(patches, draft.anchorId, {
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
