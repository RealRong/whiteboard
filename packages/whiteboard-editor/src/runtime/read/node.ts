import {
  applyNodeProjectionPatch,
  applyNodeProjectionRect,
  getNodeOutlineBounds,
  getNodeOutlineRect,
  resolveNodeConnect,
  resolveNodeEnter,
  resolveNodeRole,
  resolveNodeTransform,
  type NodeRole,
  type NodeTransform,
  type NodeRectHitOptions,
  type TransformSelectionTargets
} from '@whiteboard/core/node'
import {
  createKeyedDerivedStore
} from '@whiteboard/engine'
import type {
  KeyedReadStore,
  NodeItem
} from '@whiteboard/engine'
import type { Node, NodeId, NodeType, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { NodeDefinition, NodeRegistry } from '../../types/node'
import {
  getAABBFromPoints,
  getRotatedCorners
} from '@whiteboard/core/geometry'
import {
  type NodeTransientProjection,
  type NodeTransientReader
} from '../transient/node'

export type NodeInteraction = {
  hovered: boolean
  hidden: boolean
  hasPatch: boolean
  hasResizePreview: boolean
}

const readNodeType = (
  node: Pick<Node, 'type'> | NodeType
) => (
  typeof node === 'string'
    ? node
    : node.type
)

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
  projection: NodeTransientProjection
): NodeInteraction => ({
  hovered: projection.hovered,
  hidden: projection.hidden,
  hasPatch: Boolean(projection.patch),
  hasResizePreview: Boolean(projection.patch?.size)
})

export type NodeRead = {
  list: EngineRead['node']['list']
  committedItem: EngineRead['node']['item']
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
  idsInRect: (rect: Rect, options?: NodeRectHitOptions) => NodeId[]
  transformTargets: (
    nodeIds: readonly NodeId[]
  ) => TransformSelectionTargets<Node> | undefined
}

export const createNodeItemRead = ({
  read,
  transient
}: {
  read: Pick<EngineRead, 'node'>
  transient: NodeTransientReader
}): NodeRead['item'] => createKeyedDerivedStore({
  get: (readStore, nodeId: NodeId) => {
    const item = readStore(read.node.item, nodeId)
    if (!item) {
      return undefined
    }
    const projectionValue = readStore(transient, nodeId)
    const patch = projectionValue.patch
    if (!patch) {
      return item
    }

    const node = applyNodeProjectionPatch(item.node, patch)
    const rect = applyNodeProjectionRect(item.rect, patch)
    return node === item.node && rect === item.rect
      ? item
      : {
          node,
          rect
        }
  },
  isEqual: isNodeItemEqual
})

export const createNodeInteractionRead = ({
  transient
}: {
  transient: NodeTransientReader
}): NodeRead['interaction'] => createKeyedDerivedStore({
  get: (readStore, nodeId: NodeId) => toNodeInteraction(
    readStore(transient, nodeId)
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
    committedItem: read.node.item,
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
    idsInRect: read.node.idsInRect,
    transformTargets: read.node.transformTargets
  }
}
