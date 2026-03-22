import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import { getRectsBoundingRect } from '@whiteboard/core/geometry'
import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type {
  EdgeId,
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import {
  isOrderedArrayEqual,
  isRectEqual
} from '../utils/equality'

export type Source =
  | { kind: 'none' }
  | { kind: 'nodes'; nodeIds: readonly NodeId[] }
  | { kind: 'edge'; edgeId: EdgeId }

export type Commands = {
  replace: (nodeIds: readonly NodeId[]) => void
  add: (nodeIds: readonly NodeId[]) => void
  remove: (nodeIds: readonly NodeId[]) => void
  toggle: (nodeIds: readonly NodeId[]) => void
  selectEdge: (edgeId: EdgeId) => void
  clear: () => void
}

export type Transform = {
  move: boolean
  resize: 'none' | 'resize' | 'scale'
}

export type View = {
  kind: 'none' | 'node' | 'nodes' | 'edge'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    primary?: Node
    count: number
  }
  transform: Transform
  box?: Rect
}

export type Store = {
  source: ValueStore<Source>
  commands: Commands
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const EMPTY_NODES: readonly Node[] = []
const EMPTY_ITEMS: readonly NodeItem[] = []
const EMPTY_SOURCE: Source = {
  kind: 'none'
}
const EMPTY_TRANSFORM: Transform = {
  move: false,
  resize: 'none'
}

const readNodeItems = (
  readNode: (nodeId: NodeId) => NodeItem | undefined,
  nodeIds: readonly NodeId[]
): readonly NodeItem[] => nodeIds
  .map((nodeId) => readNode(nodeId))
  .filter((item): item is NodeItem => Boolean(item))

const isSourceEqual = (
  left: Source,
  right: Source
) => {
  if (left.kind !== right.kind) {
    return false
  }

  switch (left.kind) {
    case 'none':
      return true
    case 'edge':
      return left.edgeId === (right as Extract<Source, { kind: 'edge' }>).edgeId
    case 'nodes':
      return isOrderedArrayEqual(
        left.nodeIds,
        (right as Extract<Source, { kind: 'nodes' }>).nodeIds
      )
  }
}

export const isViewEqual = (
  left: View,
  right: View
) => (
  left.kind === right.kind
  && left.target.edgeId === right.target.edgeId
  && left.items.primary === right.items.primary
  && left.items.count === right.items.count
  && left.transform.move === right.transform.move
  && left.transform.resize === right.transform.resize
  && isOrderedArrayEqual(left.target.nodeIds, right.target.nodeIds)
  && isOrderedArrayEqual(left.items.nodes, right.items.nodes)
  && isRectEqual(left.box, right.box)
)

const toSource = (
  nodeIds: readonly NodeId[]
): Source => {
  if (!nodeIds.length) {
    return EMPTY_SOURCE
  }

  const seen = new Set<NodeId>()
  const next: NodeId[] = []

  nodeIds.forEach((nodeId) => {
    if (seen.has(nodeId)) {
      return
    }
    seen.add(nodeId)
    next.push(nodeId)
  })

  return next.length > 0
    ? { kind: 'nodes', nodeIds: next }
    : EMPTY_SOURCE
}

export const resolveView = ({
  source,
  readNode,
  readEdge,
  resolveNodeTransform
}: {
  source: Source
  readNode: (nodeId: NodeId) => NodeItem | undefined
  readEdge: (edgeId: EdgeId) => EdgeItem | undefined
  resolveNodeTransform: (node: Node) => {
    resize: boolean
    rotate: boolean
  }
}): View => {
  if (source.kind === 'edge') {
    const edgeId = readEdge(source.edgeId)?.edge.id
    return {
      kind: edgeId !== undefined ? 'edge' : 'none',
      target: {
        nodeIds: EMPTY_NODE_IDS,
        nodeSet: EMPTY_NODE_SET,
        edgeId
      },
      items: {
        nodes: EMPTY_NODES,
        primary: undefined,
        count: 0
      },
      transform: EMPTY_TRANSFORM,
      box: undefined
    }
  }

  const items = source.kind === 'nodes'
    ? readNodeItems(readNode, source.nodeIds)
    : EMPTY_ITEMS
  const nodes = items.length > 0
    ? items.map((item) => item.node)
    : EMPTY_NODES
  const nodeIds = nodes.length > 0
    ? nodes.map((node) => node.id)
    : EMPTY_NODE_IDS
  const nodeSet = nodeIds.length > 0
    ? new Set<NodeId>(nodeIds)
    : EMPTY_NODE_SET
  const count = nodes.length
  const transform = count > 0
    ? {
        move: nodes.every((node) => !node.locked),
        resize: nodes.every((node) => (
          !node.locked
          && resolveNodeTransform(node).resize
        ))
          ? 'resize' as const
          : 'none' as const
      }
    : EMPTY_TRANSFORM
  const box = items.length > 0
    ? getRectsBoundingRect(items.map((item) => item.rect))
    : undefined

  return {
    kind: count === 1
      ? 'node'
      : count > 1
        ? 'nodes'
        : 'none',
    target: {
      nodeIds,
      nodeSet,
      edgeId: undefined
    },
    items: {
      nodes,
      primary: nodes[0],
      count
    },
    transform,
    box
  }
}

export const createState = (): Store => {
  const source = createValueStore<Source>(EMPTY_SOURCE, {
    isEqual: isSourceEqual
  })
  const readSource = () => source.get()
  const writeSource = (next: Source) => {
    if (isSourceEqual(readSource(), next)) {
      return
    }
    source.set(next)
  }

  const writeNodes = (
    nodeIds: readonly NodeId[],
    mode: SelectionMode = 'replace'
  ) => {
    const current = readSource()
    const currentNodeIds = current.kind === 'nodes'
      ? current.nodeIds
      : EMPTY_NODE_IDS
    const nextNodeIds = [...applySelection(
      new Set(currentNodeIds),
      [...nodeIds],
      mode
    )]
    writeSource(toSource(nextNodeIds))
  }

  const replace = (nodeIds: readonly NodeId[]) => {
    if (!nodeIds.length) {
      writeSource(EMPTY_SOURCE)
      return
    }
    writeNodes(nodeIds, 'replace')
  }

  const add = (nodeIds: readonly NodeId[]) => {
    if (!nodeIds.length) return
    writeNodes(nodeIds, 'add')
  }

  const remove = (nodeIds: readonly NodeId[]) => {
    if (!nodeIds.length) return
    writeNodes(nodeIds, 'subtract')
  }

  const toggle = (nodeIds: readonly NodeId[]) => {
    if (!nodeIds.length) return
    writeNodes(nodeIds, 'toggle')
  }

  const selectEdge = (edgeId: EdgeId) => {
    writeSource({
      kind: 'edge',
      edgeId
    })
  }

  const clear = () => {
    writeSource(EMPTY_SOURCE)
  }

  return {
    source,
    commands: {
      replace,
      add,
      remove,
      toggle,
      selectEdge,
      clear
    }
  }
}
