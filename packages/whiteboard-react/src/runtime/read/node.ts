import {
  createKeyedDerivedStore
} from '@whiteboard/core/runtime'
import {
  getNodeOutlineBounds,
  getNodeOutlineRect,
  isContainerNode,
  matchDrawRect
} from '@whiteboard/core/node'
import type {
  KeyedReadStore,
} from '@whiteboard/core/runtime'
import type { CanvasNode, NodeItem } from '@whiteboard/core/read'
import {
  getNodeAABB,
  rectContainsRotatedRect,
  isPointInRect
} from '@whiteboard/core/geometry'
import type { NodeRectHitOptions } from '@whiteboard/core/node'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { NodeDefinition, NodeRegistry, NodeScene } from '../../types/node'
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

const readNodeType = (
  node: Pick<Node, 'type'> | string
) => (
  typeof node === 'string'
    ? node
    : node.type
)

export const resolveNodeScene = (
  definition?: Pick<NodeDefinition, 'scene'>
): NodeScene => definition?.scene === 'container'
  ? 'container'
  : 'content'

export const resolveNodeTransform = (
  definition?: Pick<NodeDefinition, 'scene' | 'canResize' | 'canRotate'>
): NodeTransform => ({
  resize: definition?.canResize ?? true,
  rotate:
    typeof definition?.canRotate === 'boolean'
      ? definition.canRotate
      : resolveNodeScene(definition) !== 'container'
})

const matchesPathNode = ({
  entry,
  rect,
  match
}: {
  entry: CanvasNode
  rect: Rect
  match: 'touch' | 'contain'
}) => {
  switch (entry.node.type) {
    case 'draw':
      return matchDrawRect({
        node: entry.node,
        rect: entry.rect,
        queryRect: rect,
        mode: match
      })
    default:
      return match === 'contain'
        ? rectContainsRotatedRect(rect, entry.rect, entry.rotation)
        : true
  }
}

const matchesNodeRect = ({
  registry,
  entry,
  rect,
  match
}: {
  registry: NodeRegistry
  entry: CanvasNode
  rect: Rect
  match: 'touch' | 'contain'
}) => {
  const definition = registry.get(entry.node.type)
  if (definition?.hit === 'path') {
    return matchesPathNode({
      entry,
      rect,
      match
    })
  }

  return match === 'contain'
    ? rectContainsRotatedRect(rect, entry.rect, entry.rotation)
    : true
}

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
  bounds: (nodeId: NodeId) => Rect | undefined
  frame: (nodeId: NodeId) => Rect | undefined
  scene: (node: Pick<Node, 'type'> | string) => NodeScene
  transform: (node: Pick<Node, 'type'> | string) => NodeTransform
  connect: (node: Pick<Node, 'type'> | string) => boolean
  filter: (nodeIds: readonly NodeId[], scene: NodeScene) => readonly NodeId[]
  containerAt: (point: Point) => NodeId | undefined
  idsInRect: (rect: Rect, options?: NodeRectHitOptions) => NodeId[]
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
  const scene = (node: Pick<Node, 'type'> | string) => resolveNodeScene(
    registry.get(readNodeType(node))
  )
  const transform = (node: Pick<Node, 'type'> | string) => resolveNodeTransform(
    registry.get(readNodeType(node))
  )
  const connect = (node: Pick<Node, 'type'> | string) => resolveNodeConnect(
    registry.get(readNodeType(node))
  )

  return {
    list: read.node.list,
    item,
    bounds: (nodeId) => {
      const nextItem = item.get(nodeId)
      if (!nextItem) {
        return undefined
      }

      const rotation = typeof nextItem.node.rotation === 'number'
        ? nextItem.node.rotation
        : 0

      return nextItem.node.type === 'shape'
        ? getNodeOutlineBounds(nextItem.node, nextItem.rect, rotation)
        : getNodeAABB(nextItem.node, nextItem.rect)
    },
    frame: (nodeId) => {
      const nextItem = item.get(nodeId)
      if (!nextItem) {
        return undefined
      }

      return nextItem.node.type === 'shape'
        ? getNodeOutlineRect(nextItem.node, nextItem.rect)
        : nextItem.rect
    },
    scene,
    transform,
    connect,
    filter: (nodeIds, expectedScene) => nodeIds.filter((nodeId) => {
      const nextItem = item.get(nodeId)
      if (!nextItem) {
        return false
      }

      return scene(nextItem.node) === expectedScene
    }),
    containerAt: (point) => {
      const nodeIds = read.node.list.get()

      for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
        const nodeId = nodeIds[index]
        const entry = read.index.node.get(nodeId)
        if (!entry) {
          continue
        }

        if (
          scene(entry.node) !== 'container'
          || !isContainerNode(entry.node)
        ) {
          continue
        }

        if (isPointInRect(point, entry.rect)) {
          return nodeId
        }
      }

      return undefined
    },
    idsInRect: (rect, options) => {
      const match = options?.match ?? 'touch'
      const candidateIds = read.index.node.idsInRect(rect, {
        ...options,
        match: match === 'contain' ? 'touch' : match
      })
      const candidateSet = new Set(candidateIds)
      const matchCache = new Map<NodeId, boolean>()

      const matchesCandidate = (
        nodeId: NodeId
      ): boolean => {
        const cached = matchCache.get(nodeId)
        if (cached !== undefined) {
          return cached
        }

        if (!candidateSet.has(nodeId)) {
          matchCache.set(nodeId, false)
          return false
        }

        const entry = read.index.node.get(nodeId)
        if (!entry) {
          matchCache.set(nodeId, false)
          return false
        }

        if (entry.node.type === 'group') {
          const descendantIds = read.tree.get(nodeId)
          const matched = descendantIds.length > 0 && (
            match === 'contain'
              ? descendantIds.every((descendantId) => matchesCandidate(descendantId))
              : descendantIds.some((descendantId) => matchesCandidate(descendantId))
          )
          matchCache.set(nodeId, matched)
          return matched
        }

        const matched = matchesNodeRect({
          registry,
          entry,
          rect,
          match
        })
        matchCache.set(nodeId, matched)
        return matched
      }

      return candidateIds.filter((nodeId) => matchesCandidate(nodeId))
    }
  }
}
