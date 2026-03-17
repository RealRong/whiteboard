import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  createDerivedStore,
  createValueStore,
  type KeyedReadStore,
  type ReadStore,
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

export type { SelectionMode as Mode } from '@whiteboard/core/node'

export type Source =
  | { kind: 'none' }
  | { kind: 'nodes'; nodeIds: readonly NodeId[] }
  | { kind: 'edge'; edgeId: EdgeId }

export type Commands = {
  nodes: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
  edge: (edgeId?: EdgeId) => void
  clear: () => void
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
  box?: Rect
}

export type Store = {
  source: ValueStore<Source>
  store: ReadStore<View>
  commands: Commands
}

type ReadDeps = {
  node: {
    item: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  }
  edge: {
    item: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  }
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const EMPTY_NODES: readonly Node[] = []
const EMPTY_ITEMS: readonly NodeItem[] = []
const EMPTY_SOURCE: Source = {
  kind: 'none'
}

const getBoundingRect = (rects: readonly Rect[]): Rect | undefined => {
  if (!rects.length) {
    return undefined
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  rects.forEach((rect) => {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  })

  if (
    !Number.isFinite(minX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxX)
    || !Number.isFinite(maxY)
  ) {
    return undefined
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
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

const isViewEqual = (
  left: View,
  right: View
) => (
  left.kind === right.kind
  && left.target.edgeId === right.target.edgeId
  && left.items.primary === right.items.primary
  && left.items.count === right.items.count
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

const resolveView = ({
  source,
  readNode,
  readEdge
}: {
  source: Source
  readNode: (nodeId: NodeId) => NodeItem | undefined
  readEdge: (edgeId: EdgeId) => EdgeItem | undefined
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
  const box = items.length > 0
    ? getBoundingRect(items.map((item) => item.rect))
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
    box
  }
}

export const createState = ({
  read
}: {
  read: ReadDeps
}): Store => {
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

  const store = createDerivedStore<View>({
    get: (readStore) => resolveView({
      source: readStore(source),
      readNode: (nodeId) => readStore(read.node.item, nodeId),
      readEdge: (edgeId) => readStore(read.edge.item, edgeId)
    }),
    isEqual: isViewEqual
  })

  const nodes = (
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

  const edge = (edgeId?: EdgeId) => {
    const current = readSource()
    if (edgeId === undefined) {
      if (current.kind !== 'edge') {
        return
      }
      writeSource(EMPTY_SOURCE)
      return
    }

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
    store,
    commands: {
      nodes,
      edge,
      clear
    }
  }
}
