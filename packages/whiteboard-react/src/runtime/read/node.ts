import {
  createDerivedStore,
  createKeyedDerivedStore
} from '@whiteboard/core/runtime'
import { matchDrawRect } from '@whiteboard/core/node'
import type {
  KeyedReadStore,
  ReadStore
} from '@whiteboard/core/runtime'
import type { CanvasNode, NodeItem } from '@whiteboard/core/read'
import {
  rectContainsRotatedRect,
  isPointInRect
} from '@whiteboard/core/geometry'
import type { NodeRectHitOptions } from '@whiteboard/core/node'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { NodeDefinition, NodeRegistry, NodeScene } from '../../types/node'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import type { View as SelectionView } from '../selection'
import type { Tool } from '../tool'
import {
  projectNodeItem,
  type NodeSessionReader
} from '../../features/node/session/node'
import type { NodePress } from '../../features/node/session/runtime'

export type NodeChrome = {
  selection: boolean
  toolbar: boolean
  transform: boolean
  connect: boolean
}

export type NodeTransform = {
  resize: boolean
  rotate: boolean
}

const isChromeEqual = (
  left: NodeChrome,
  right: NodeChrome
) => (
  left.selection === right.selection
  && left.toolbar === right.toolbar
  && left.transform === right.transform
  && left.connect === right.connect
)

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

const showsSelection = (
  press: NodePress
) => press === null || press === 'repeat'

const resolveNodeChrome = ({
  tool,
  edit,
  selection,
  interaction,
  press
}: {
  tool: Tool
  edit: EditTarget
  selection: SelectionView
  interaction: InteractionMode
  press: NodePress
}): NodeChrome => {
  const selectionVisible = showsSelection(press)
  const editing = edit !== null
  const edgeSelected = selection.target.edgeId !== undefined
  const idle = interaction === 'idle'

  return {
    selection: selectionVisible,
    toolbar:
      tool.type === 'select'
      && !editing
      && idle
      && selectionVisible
      && !edgeSelected
      && selection.items.count > 0,
    transform:
      tool.type === 'select'
      && !editing
      && !edgeSelected
      && (
        interaction === 'node-transform'
        || (idle && selectionVisible)
      ),
    connect:
      tool.type === 'edge'
      && !editing
      && idle
      && selectionVisible
  }
}

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
  chrome: ReadStore<NodeChrome>
  scene: (node: Pick<Node, 'type'> | string) => NodeScene
  transform: (node: Pick<Node, 'type'> | string) => NodeTransform
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

export const createNodeChromeRead = ({
  tool,
  edit,
  selection,
  interaction,
  press
}: {
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionView>
  interaction: ReadStore<InteractionMode>
  press: ReadStore<NodePress>
}): NodeRead['chrome'] => createDerivedStore<NodeChrome>({
  get: (readStore) => resolveNodeChrome({
    tool: readStore(tool),
    edit: readStore(edit),
    selection: readStore(selection),
    interaction: readStore(interaction),
    press: readStore(press)
  }),
  isEqual: isChromeEqual
})

export const createNodeRead = ({
  read,
  registry,
  item,
  tool,
  edit,
  selection,
  interaction,
  press
}: {
  read: EngineRead
  registry: NodeRegistry
  item: KeyedReadStore<NodeId, NodeItem | undefined>
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionView>
  interaction: ReadStore<InteractionMode>
  press: ReadStore<NodePress>
}): NodeRead => {
  const chrome = createNodeChromeRead({
    tool,
    edit,
    selection,
    interaction,
    press
  })
  const scene = (node: Pick<Node, 'type'> | string) => resolveNodeScene(
    registry.get(readNodeType(node))
  )
  const transform = (node: Pick<Node, 'type'> | string) => resolveNodeTransform(
    registry.get(readNodeType(node))
  )

  return {
    list: read.node.list,
    item,
    chrome,
    scene,
    transform,
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

        if (scene(entry.node) !== 'container') {
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
      const candidates = read.index.node.idsInRect(rect, {
        ...options,
        match: match === 'contain' ? 'touch' : match
      })

      return candidates.filter((nodeId) => {
        const entry = read.index.node.get(nodeId)
        if (!entry) {
          return false
        }

        return matchesNodeRect({
          registry,
          entry,
          rect,
          match
        })
      })
    }
  }
}
