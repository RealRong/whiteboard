import type { BoardConfig } from '@whiteboard/core/config'
import {
  computeSnap,
  expandRectByThreshold,
  findSmallestContainerAtPoint,
  getContainerDescendants,
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
import { moveEdgePath } from '@whiteboard/core/edge'
import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeId, EdgePatch, Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core/types'
import { mergeObjectPatch } from '../../../../runtime/utils/recordPatch'

type DragMember = {
  id: NodeId
  offset: Point
}

export type NodeDragRuntimeState = {
  anchorId: NodeId
  roots: DragMember[]
  members: DragMember[]
  startWorld: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
}

type NodeDragPositionUpdate = {
  id: NodeId
  position: Point
}

type NodeDragPreviewResult = {
  position: Point
  guides: readonly Guide[]
  hoveredContainerId?: NodeId
  patches: NodeDragPositionUpdate[]
}

const SNAP_CROSS_THRESHOLD_RATIO = 0.6
const EDGE_FOLLOW_DELTA_EPSILON = 0.001

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
  members.push(createDragMember(anchor, node))
}

const createDragMember = (
  anchor: Point,
  node: Node
): DragMember => ({
  id: node.id,
  offset: {
    x: node.position.x - anchor.x,
    y: node.position.y - anchor.y
  }
})

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
  patches.set(id, mergeObjectPatch(prev, patch))
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
  startWorld: Point
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
    startWorld,
    origin,
    size,
    selectedNodeIds
  } = options
  const nodeById = toNodeById(nodes)
  const rootIds = getDragRootIds(nodes, anchorId, selectedNodeIds)
  const roots: DragMember[] = []
  const members: DragMember[] = []
  const memberIds = new Set<NodeId>()

  rootIds.forEach((rootId) => {
    const root = nodeById.get(rootId)
    if (!root) return
    roots.push(createDragMember(origin, root))
    appendDragMembers(members, memberIds, origin, root)
    if (root.type !== 'group') return
    getContainerDescendants(nodes, root.id).forEach((child) => {
      appendDragMembers(members, memberIds, origin, child)
    })
  })

  return {
    anchorId,
    roots,
    members,
    startWorld,
    origin,
    last: origin,
    size
  }
}

const isSameDelta = (
  left: Point,
  right: Point,
  epsilon = EDGE_FOLLOW_DELTA_EPSILON
) => (
  Math.abs(left.x - right.x) <= epsilon
  && Math.abs(left.y - right.y) <= epsilon
)

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

export const resolveNodeDragPositions = (
  active: NodeDragRuntimeState,
  anchorPosition: Point
) => buildPositionUpdates(active.members, anchorPosition)

export const resolveNodeDragFollowEdges = (options: {
  active: NodeDragRuntimeState
  positions: readonly NodeDragPositionUpdate[]
  edgeIds: readonly EdgeId[]
  readEdge: (edgeId: EdgeId) => Readonly<EdgeItem> | undefined
}): Array<{ id: EdgeId; patch: EdgePatch }> => {
  const { active, positions, edgeIds, readEdge } = options
  const memberById = new Map(active.members.map((member) => [member.id, member]))
  const deltaById = new Map<NodeId, Point>()

  positions.forEach((position) => {
    const member = memberById.get(position.id)
    if (!member) {
      return
    }

    const delta = {
      x: position.position.x - (active.origin.x + member.offset.x),
      y: position.position.y - (active.origin.y + member.offset.y)
    }
    if (delta.x === 0 && delta.y === 0) {
      return
    }

    deltaById.set(position.id, delta)
  })

  if (!deltaById.size) {
    return []
  }

  const updates: Array<{ id: EdgeId; patch: EdgePatch }> = []
  edgeIds.forEach((edgeId) => {
    const edge = readEdge(edgeId)?.edge
    if (!edge) {
      return
    }
    if (edge.source.kind !== 'node' || edge.target.kind !== 'node') {
      return
    }

    const sourceDelta = deltaById.get(edge.source.nodeId)
    const targetDelta = deltaById.get(edge.target.nodeId)
    if (!sourceDelta || !targetDelta || !isSameDelta(sourceDelta, targetDelta)) {
      return
    }

    const patch = moveEdgePath(edge, sourceDelta)
    if (!patch) {
      return
    }

    updates.push({
      id: edge.id,
      patch
    })
  })

  return updates
}

export const resolveNodeDragPreview = (options: {
  active: NodeDragRuntimeState
  world: Point
  zoom: number
  snapEnabled: boolean
  allowCross: boolean
  nodes: readonly Node[]
  config: Pick<BoardConfig, 'node' | 'nodeSize'>
  readSnapCandidatesInRect: (rect: Rect) => readonly SnapCandidate[]
}): NodeDragPreviewResult => {
  const {
    active,
    world,
    zoom,
    snapEnabled,
    allowCross,
    nodes,
    config,
    readSnapCandidatesInRect
  } = options
  const safeZoom = resolveInteractionZoom(zoom)
  const basePosition = {
    x: active.origin.x + (world.x - active.startWorld.x),
    y: active.origin.y + (world.y - active.startWorld.y)
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

  const rootPositions = buildPositionUpdates(active.roots, position)
  const hoveredContainerId = resolveHoveredContainerId({
    roots: rootPositions,
    nodes,
    config,
    excludeNodeIds: new Set(active.members.map((member) => member.id))
  })

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
  config: Pick<BoardConfig, 'node' | 'nodeSize'>
}): Array<{ id: NodeId; patch: NodePatch }> => {
  const { draft, nodes, config } = options
  const nodeById = toNodeById(nodes)

  const updates = buildPositionUpdates(draft.members, draft.last)
  const rootUpdates = buildPositionUpdates(draft.roots, draft.last)

  const patches = new Map<NodeId, NodePatch>()
  updates.forEach((update) => {
    mergePatch(patches, update.id, {
      position: update.position
    })
  })

  const targetByRootId = resolveRootContainerTargets({
    roots: rootUpdates,
    nodes,
    config,
    excludeNodeIds: new Set(draft.members.map((member) => member.id))
  })
  rootUpdates.forEach((update) => {
    const node = nodeById.get(update.id)
    if (!node) {
      return
    }

    const targetContainerId = targetByRootId.get(update.id)
    if (targetContainerId && targetContainerId !== node.parentId) {
      mergePatch(patches, update.id, {
        parentId: targetContainerId
      })
      return
    }

    if (!node.parentId) {
      return
    }

    const parentNode = nodeById.get(node.parentId)
    if (!parentNode) {
      return
    }

    const nextNode: Node = {
      ...node,
      position: update.position
    }
    const nextRect = getNodeAABB(nextNode, config.nodeSize)
    const parentRect = getNodeAABB(parentNode, config.nodeSize)
    if (!rectContains(parentRect, nextRect)) {
      mergePatch(patches, update.id, {
        parentId: undefined
      })
    }
  })

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

const resolveRootContainerTargets = (options: {
  roots: readonly NodeDragPositionUpdate[]
  nodes: readonly Node[]
  config: Pick<BoardConfig, 'nodeSize'>
  excludeNodeIds: ReadonlySet<NodeId>
}) => {
  const {
    roots,
    nodes,
    config,
    excludeNodeIds
  } = options
  const nodeById = toNodeById(nodes)
  const containerNodes = nodes.filter((node) => !excludeNodeIds.has(node.id))
  const targets = new Map<NodeId, NodeId | undefined>()

  roots.forEach((root) => {
    const node = nodeById.get(root.id)
    if (!node) {
      return
    }

    const nextNode: Node = {
      ...node,
      position: root.position
    }
    const rect = getNodeAABB(nextNode, config.nodeSize)
    const target = findSmallestContainerAtPoint(
      containerNodes,
      config.nodeSize,
      {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      },
      node.id
    )?.id
    targets.set(root.id, target)
  })

  return targets
}

const resolveHoveredContainerId = (options: {
  roots: readonly NodeDragPositionUpdate[]
  nodes: readonly Node[]
  config: Pick<BoardConfig, 'nodeSize'>
  excludeNodeIds: ReadonlySet<NodeId>
}) => {
  const targets = resolveRootContainerTargets(options)
  let hovered: NodeId | undefined

  for (const target of targets.values()) {
    if (!target) {
      return undefined
    }
    if (hovered === undefined) {
      hovered = target
      continue
    }
    if (hovered !== target) {
      return undefined
    }
  }

  return hovered
}
