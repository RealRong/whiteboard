import {
  createKeyedDerivedStore
} from '@whiteboard/core/runtime'
import type {
  KeyedReadStore,
} from '@whiteboard/core/runtime'
import type { NodeItem } from '@whiteboard/core/read'
import type {
  NodeRectHitOptions,
  TransformSelectionTargets
} from '@whiteboard/core/node'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { NodeDefinition, NodeRegistry, NodeRole } from '../../types/node'
import {
  projectNodeItem,
  type NodeSessionReader
} from '../../features/node/session/node'

export type NodeTransform = {
  resize: boolean
  rotate: boolean
}

const resolveNodeConnect = (
  definition?: Pick<NodeDefinition, 'connect'>
) => definition?.connect ?? true

const resolveNodeEnter = (
  definition?: Pick<NodeDefinition, 'enter'>
) => definition?.enter ?? false

const readNodeType = (
  node: Pick<Node, 'type'> | string
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

export type NodeRead = {
  list: EngineRead['node']['list']
  item: KeyedReadStore<NodeId, NodeItem | undefined>
  owner: (nodeId: NodeId) => NodeId | undefined
  bounds: (nodeId: NodeId) => Rect | undefined
  frame: (nodeId: NodeId) => Rect | undefined
  role: (node: Pick<Node, 'type'> | string) => NodeRole
  transform: (node: Pick<Node, 'type'> | string) => NodeTransform
  connect: (node: Pick<Node, 'type'> | string) => boolean
  enter: (node: Pick<Node, 'type'> | string) => boolean
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

export const createNodeRead = ({
  read,
  registry,
  item
}: {
  read: EngineRead
  registry: NodeRegistry
  item: KeyedReadStore<NodeId, NodeItem | undefined>
}): NodeRead => {
  const role = (node: Pick<Node, 'type'> | string) => resolveNodeRole(
    registry.get(readNodeType(node))
  )
  const transform = (node: Pick<Node, 'type'> | string) => resolveNodeTransform(
    registry.get(readNodeType(node))
  )
  const connect = (node: Pick<Node, 'type'> | string) => resolveNodeConnect(
    registry.get(readNodeType(node))
  )
  const enter = (node: Pick<Node, 'type'> | string) => resolveNodeEnter(
    registry.get(readNodeType(node))
  )

  return {
    list: read.node.list,
    item,
    owner: read.node.owner,
    bounds: read.node.bounds,
    frame: read.node.frame,
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
