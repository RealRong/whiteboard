import {
  createKeyedDerivedStore
} from '@whiteboard/engine'
import type {
  KeyedReadStore,
  NodeItem
} from '@whiteboard/engine'
import {
  getNodeOutlineBounds,
  getNodeOutlineRect,
  type NodeRectHitOptions,
  type TransformSelectionTargets
} from '@whiteboard/core/node'
import type { Node, NodeId, NodeType, Point, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { NodeDefinition, NodeRegistry, NodeRole } from '../../types/node'
import {
  getAABBFromPoints,
  getRotatedCorners
} from '@whiteboard/core/geometry'
import {
  projectNodeItem,
  type NodeSession,
  type NodeSessionReader
} from '../../features/node/session/node'

export type NodeTransform = {
  resize: boolean
  rotate: boolean
}

export type NodeInteraction = {
  hovered: boolean
  hidden: boolean
  hasPatch: boolean
  hasResizePreview: boolean
}

const resolveNodeConnect = (
  definition?: Pick<NodeDefinition, 'connect'>
) => definition?.connect ?? true

const resolveNodeEnter = (
  definition?: Pick<NodeDefinition, 'enter'>
) => definition?.enter ?? false

const readNodeType = (
  node: Pick<Node, 'type'> | NodeType
) => (
  typeof node === 'string'
    ? node
    : node.type
)

export const resolveNodeRole = (
  definition?: Pick<NodeDefinition, 'role'>
): NodeRole => definition?.role ?? 'content'

export const resolveNodeTransform = (
  definition?: Pick<NodeDefinition, 'role' | 'canResize' | 'canRotate'>
): NodeTransform => ({
  resize: definition?.canResize ?? true,
  rotate:
    typeof definition?.canRotate === 'boolean'
      ? definition.canRotate
      : resolveNodeRole(definition) === 'content'
})

const isNodeItemEqual = (
  left: NodeItem | undefined,
  right: NodeItem | undefined
) => (
  left === right
  || (
    left?.node === right?.node
    && left?.rect.x === right?.rect.x
    && left?.rect.y === right?.rect.y
    && left?.rect.width === right?.rect.width
    && left?.rect.height === right?.rect.height
  )
)

const isNodeInteractionEqual = (
  left: NodeInteraction,
  right: NodeInteraction
) => (
  left.hovered === right.hovered
  && left.hidden === right.hidden
  && left.hasPatch === right.hasPatch
  && left.hasResizePreview === right.hasResizePreview
)

const readNodeRotation = (
  node: NodeItem['node']
) => (
  node.type === 'group'
    ? 0
    : (typeof node.rotation === 'number' ? node.rotation : 0)
)

const readNodeItemBounds = (
  item: NodeItem
): Rect => {
  const rotation = readNodeRotation(item.node)

  if (item.node.type === 'group') {
    return item.rect
  }

  if (item.node.type === 'shape') {
    return getNodeOutlineBounds(item.node, item.rect, rotation)
  }

  return rotation === 0
    ? item.rect
    : getAABBFromPoints(getRotatedCorners(item.rect, rotation))
}

const readNodeItemFrame = (
  item: NodeItem
): Rect => item.node.type === 'shape'
  ? getNodeOutlineRect(item.node, item.rect)
  : item.rect

const toNodeInteraction = (
  session: NodeSession
): NodeInteraction => ({
  hovered: session.hovered,
  hidden: session.hidden,
  hasPatch: Boolean(session.patch),
  hasResizePreview: Boolean(session.patch?.size)
})

export type NodeRead = {
  list: EngineRead['node']['list']
  item: KeyedReadStore<NodeId, NodeItem | undefined>
  interaction: KeyedReadStore<NodeId, NodeInteraction>
  owner: (nodeId: NodeId) => NodeId | undefined
  bounds: (nodeId: NodeId) => Rect | undefined
  frame: (nodeId: NodeId) => Rect | undefined
  role: (node: Pick<Node, 'type'> | NodeType) => NodeRole
  transform: (node: Pick<Node, 'type'> | NodeType) => NodeTransform
  connect: (node: Pick<Node, 'type'> | NodeType) => boolean
  enter: (node: Pick<Node, 'type'> | NodeType) => boolean
  filter: (nodeIds: readonly NodeId[], role: NodeRole) => readonly NodeId[]
  frameAt: (point: Point) => NodeId | undefined
  idsInRect: (rect: Rect, options?: NodeRectHitOptions) => NodeId[]
  transformTargets: (
    nodeIds: readonly NodeId[]
  ) => TransformSelectionTargets<Node> | undefined
}

export const createNodeItemRead = ({
  read,
  session
}: {
  read: Pick<EngineRead, 'node'>
  session: NodeSessionReader
}): NodeRead['item'] => createKeyedDerivedStore({
  get: (readStore, nodeId: NodeId) => {
    const item = readStore(read.node.item, nodeId)
    if (!item) {
      return undefined
    }
    const sessionValue = readStore(session, nodeId)
    return projectNodeItem(item, sessionValue)
  },
  isEqual: isNodeItemEqual
})

export const createNodeInteractionRead = ({
  session
}: {
  session: NodeSessionReader
}): NodeRead['interaction'] => createKeyedDerivedStore({
  get: (readStore, nodeId: NodeId) => toNodeInteraction(
    readStore(session, nodeId)
  ),
  isEqual: isNodeInteractionEqual
})

export const createNodeRead = ({
  read,
  registry,
  item,
  interaction
}: {
  read: EngineRead
  registry: NodeRegistry
  item: KeyedReadStore<NodeId, NodeItem | undefined>
  interaction: KeyedReadStore<NodeId, NodeInteraction>
}): NodeRead => {
  const role = (node: Pick<Node, 'type'> | NodeType) => resolveNodeRole(
    registry.get(readNodeType(node))
  )
  const transform = (node: Pick<Node, 'type'> | NodeType) => resolveNodeTransform(
    registry.get(readNodeType(node))
  )
  const connect = (node: Pick<Node, 'type'> | NodeType) => resolveNodeConnect(
    registry.get(readNodeType(node))
  )
  const enter = (node: Pick<Node, 'type'> | NodeType) => resolveNodeEnter(
    registry.get(readNodeType(node))
  )

  return {
    list: read.node.list,
    item,
    interaction,
    owner: read.node.owner,
    bounds: (nodeId) => {
      const nextItem = item.get(nodeId)
      return nextItem
        ? readNodeItemBounds(nextItem)
        : undefined
    },
    frame: (nodeId) => {
      const nextItem = item.get(nodeId)
      return nextItem
        ? readNodeItemFrame(nextItem)
        : undefined
    },
    role,
    transform,
    connect,
    enter,
    filter: (nodeIds, expectedRole) => nodeIds.filter((nodeId) => {
      const nextItem = item.get(nodeId)
      if (!nextItem) {
        return false
      }

      return role(nextItem.node) === expectedRole
    }),
    frameAt: read.node.frameAt,
    idsInRect: read.node.idsInRect,
    transformTargets: read.node.transformTargets
  }
}
