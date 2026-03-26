import { moveEdgeRoute } from '../edge'
import {
  getNodeAABB,
  rectContains
} from '../geometry'
import type {
  Edge,
  EdgeId,
  EdgePatch,
  Node,
  NodeId,
  Point,
  Size
} from '../types'
import {
  expandGroupMembers,
  filterRootIds,
  findSmallestContainerAtPoint,
  getNodeOwnerMap,
  isContainerNode
} from './group'

export type MoveMember = {
  id: NodeId
  position: Point
}

export type MoveSet = {
  rootIds: readonly NodeId[]
  members: readonly MoveMember[]
}

export type MoveNodePosition = {
  id: NodeId
  position: Point
}

export type MoveOwnerChange = {
  id: NodeId
  ownerId?: NodeId
}

export type MoveEdgeChange = {
  id: EdgeId
  patch: EdgePatch
}

export type MoveEffect = {
  nodes: readonly MoveNodePosition[]
  owners: readonly MoveOwnerChange[]
  edges: readonly MoveEdgeChange[]
  hoveredContainerId?: NodeId
}

const EMPTY_ROOT_IDS: readonly NodeId[] = []
const EMPTY_MEMBERS: readonly MoveMember[] = []
const EMPTY_POSITIONS: readonly MoveNodePosition[] = []
const EMPTY_OWNERS: readonly MoveOwnerChange[] = []
const EMPTY_EDGES: readonly MoveEdgeChange[] = []
const EMPTY_MEMBER_ID_SET: ReadonlySet<NodeId> = new Set<NodeId>()

const toNodeById = (
  nodes: readonly Node[]
): ReadonlyMap<NodeId, Node> =>
  new Map(nodes.map((node) => [node.id, node]))

const toMemberIdSet = (
  members: readonly MoveMember[]
): ReadonlySet<NodeId> => (
  members.length > 0
    ? new Set(members.map((member) => member.id))
    : EMPTY_MEMBER_ID_SET
)

const toPositionById = (
  positions: readonly MoveNodePosition[]
): ReadonlyMap<NodeId, Point> =>
  new Map(positions.map((entry) => [entry.id, entry.position]))

export const buildMoveSet = (options: {
  nodes: readonly Node[]
  ids: readonly NodeId[]
}): MoveSet => {
  const { nodes, ids } = options
  const rootIds = filterRootIds(nodes, ids)
  if (!rootIds.length) {
    return {
      rootIds: EMPTY_ROOT_IDS,
      members: EMPTY_MEMBERS
    }
  }

  const members = expandGroupMembers(nodes, rootIds).map((node) => ({
    id: node.id,
    position: node.position
  }))

  return {
    rootIds,
    members: members.length > 0 ? members : EMPTY_MEMBERS
  }
}

export const projectMovePositions = (
  members: readonly MoveMember[],
  delta: Point
): readonly MoveNodePosition[] => {
  if (!members.length) {
    return EMPTY_POSITIONS
  }

  return members.map((member) => ({
    id: member.id,
    position: {
      x: member.position.x + delta.x,
      y: member.position.y + delta.y
    }
  }))
}

const resolveFrameOwnerTarget = (options: {
  node: Node
  position: Point
  containerNodes: readonly Node[]
  nodeSize: Size
}): NodeId | undefined => {
  const nextNode: Node = {
    ...options.node,
    position: options.position
  }
  const rect = getNodeAABB(nextNode, options.nodeSize)

  return findSmallestContainerAtPoint(
    options.containerNodes,
    options.nodeSize,
    {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    },
    options.node.id
  )?.id
}

const resolveSharedContainerTarget = (options: {
  rootIds: readonly NodeId[]
  positionById: ReadonlyMap<NodeId, Point>
  nodeById: ReadonlyMap<NodeId, Node>
  containerNodes: readonly Node[]
  nodeSize: Size
}): NodeId | undefined => {
  let hovered: NodeId | undefined

  for (let index = 0; index < options.rootIds.length; index += 1) {
    const rootId = options.rootIds[index]!
    const node = options.nodeById.get(rootId)
    const position = options.positionById.get(rootId)
    if (!node || !position) {
      continue
    }

    const target = resolveFrameOwnerTarget({
      node,
      position,
      containerNodes: options.containerNodes,
      nodeSize: options.nodeSize
    })
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

const collectOwnerChanges = (options: {
  rootIds: readonly NodeId[]
  nodeById: ReadonlyMap<NodeId, Node>
  ownerByChildId: ReadonlyMap<NodeId, NodeId>
  positionById: ReadonlyMap<NodeId, Point>
  containerNodes: readonly Node[]
  nodeSize: Size
}): readonly MoveOwnerChange[] => {
  if (!options.rootIds.length) {
    return EMPTY_OWNERS
  }

  const changes: MoveOwnerChange[] = []

  options.rootIds.forEach((nodeId) => {
    const node = options.nodeById.get(nodeId)
    const position = options.positionById.get(nodeId)
    if (!node || !position) {
      return
    }

    const currentOwnerId = options.ownerByChildId.get(node.id)
    const currentOwner = currentOwnerId
      ? options.nodeById.get(currentOwnerId)
      : undefined

    if (currentOwner?.type === 'group') {
      return
    }

    const targetOwnerId = resolveFrameOwnerTarget({
      node,
      position,
      containerNodes: options.containerNodes,
      nodeSize: options.nodeSize
    })

    if (targetOwnerId && targetOwnerId !== currentOwnerId) {
      changes.push({
        id: node.id,
        ownerId: targetOwnerId
      })
      return
    }

    if (!currentOwnerId || currentOwner?.type !== 'frame') {
      return
    }

    const nextNode: Node = {
      ...node,
      position
    }
    const containerRect = getNodeAABB(currentOwner, options.nodeSize)
    const nextRect = getNodeAABB(nextNode, options.nodeSize)
    if (!rectContains(containerRect, nextRect)) {
      changes.push({
        id: node.id,
        ownerId: undefined
      })
    }
  })

  return changes.length > 0 ? changes : EMPTY_OWNERS
}

const collectFollowEdgePatches = (options: {
  memberIds: ReadonlySet<NodeId>
  delta: Point
  edges: readonly Edge[]
}): readonly MoveEdgeChange[] => {
  if (!options.memberIds.size || (options.delta.x === 0 && options.delta.y === 0)) {
    return EMPTY_EDGES
  }

  const changes: MoveEdgeChange[] = []

  options.edges.forEach((edge) => {
    if (edge.source.kind !== 'node' || edge.target.kind !== 'node') {
      return
    }
    if (
      !options.memberIds.has(edge.source.nodeId)
      || !options.memberIds.has(edge.target.nodeId)
    ) {
      return
    }

    const patch = moveEdgeRoute(edge, options.delta)
    if (!patch) {
      return
    }

    changes.push({
      id: edge.id,
      patch
    })
  })

  return changes.length > 0 ? changes : EMPTY_EDGES
}

export const resolveMoveEffect = (options: {
  nodes: readonly Node[]
  edges?: readonly Edge[]
  move: MoveSet
  delta: Point
  nodeSize: Size
}): MoveEffect => {
  const positions = projectMovePositions(options.move.members, options.delta)
  if (!positions.length) {
    return {
      nodes: EMPTY_POSITIONS,
      owners: EMPTY_OWNERS,
      edges: EMPTY_EDGES
    }
  }

  const nodeById = toNodeById(options.nodes)
  const ownerByChildId = getNodeOwnerMap(options.nodes)
  const memberIds = toMemberIdSet(options.move.members)
  const positionById = toPositionById(positions)
  const containerNodes = options.nodes.filter((node) => (
    !memberIds.has(node.id)
    && isContainerNode(node)
  ))

  return {
    nodes: positions,
    owners: collectOwnerChanges({
      rootIds: options.move.rootIds,
      nodeById,
      ownerByChildId,
      positionById,
      containerNodes,
      nodeSize: options.nodeSize
    }),
    edges: collectFollowEdgePatches({
      memberIds,
      delta: options.delta,
      edges: options.edges ?? []
    }),
    hoveredContainerId: resolveSharedContainerTarget({
      rootIds: options.move.rootIds,
      positionById,
      nodeById,
      containerNodes,
      nodeSize: options.nodeSize
    })
  }
}
