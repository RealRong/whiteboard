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

export type MoveContainerChange = {
  id: NodeId
  containerId?: NodeId
}

export type MoveEdgeChange = {
  id: EdgeId
  patch: EdgePatch
}

export type MoveEffect = {
  nodes: readonly MoveNodePosition[]
  containers: readonly MoveContainerChange[]
  edges: readonly MoveEdgeChange[]
  hoveredContainerId?: NodeId
}

const EMPTY_ROOT_IDS: readonly NodeId[] = []
const EMPTY_MEMBERS: readonly MoveMember[] = []
const EMPTY_POSITIONS: readonly MoveNodePosition[] = []
const EMPTY_CONTAINERS: readonly MoveContainerChange[] = []
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

const resolveContainerTarget = (options: {
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

    const target = resolveContainerTarget({
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

const collectContainerChanges = (options: {
  members: readonly MoveMember[]
  nodeById: ReadonlyMap<NodeId, Node>
  positionById: ReadonlyMap<NodeId, Point>
  containerNodes: readonly Node[]
  nodeSize: Size
}): readonly MoveContainerChange[] => {
  if (!options.members.length) {
    return EMPTY_CONTAINERS
  }

  const changes: MoveContainerChange[] = []

  options.members.forEach((member) => {
    const node = options.nodeById.get(member.id)
    const position = options.positionById.get(member.id)
    if (!node || !position) {
      return
    }

    const targetContainerId = resolveContainerTarget({
      node,
      position,
      containerNodes: options.containerNodes,
      nodeSize: options.nodeSize
    })

    if (targetContainerId && targetContainerId !== node.containerId) {
      changes.push({
        id: node.id,
        containerId: targetContainerId
      })
      return
    }

    if (!node.containerId) {
      return
    }

    const containerNode = options.nodeById.get(node.containerId)
    if (!containerNode || !isContainerNode(containerNode)) {
      return
    }

    const nextNode: Node = {
      ...node,
      position
    }
    const containerRect = getNodeAABB(containerNode, options.nodeSize)
    const nextRect = getNodeAABB(nextNode, options.nodeSize)
    if (!rectContains(containerRect, nextRect)) {
      changes.push({
        id: node.id,
        containerId: undefined
      })
    }
  })

  return changes.length > 0 ? changes : EMPTY_CONTAINERS
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
      containers: EMPTY_CONTAINERS,
      edges: EMPTY_EDGES
    }
  }

  const nodeById = toNodeById(options.nodes)
  const memberIds = toMemberIdSet(options.move.members)
  const positionById = toPositionById(positions)
  const containerNodes = options.nodes.filter((node) => (
    !memberIds.has(node.id)
    && isContainerNode(node)
  ))

  return {
    nodes: positions,
    containers: collectContainerChanges({
      members: options.move.members,
      nodeById,
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
