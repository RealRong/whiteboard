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
import type { NodeItem } from '@whiteboard/core/read'
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

export type { SelectionMode } from '@whiteboard/core/node'

export type SelectionCommands = {
  select: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
  selectEdge: (edgeId?: EdgeId) => void
  selectAll: () => void
  clear: () => void
}

type StoredSelection = {
  nodeIds: readonly NodeId[]
  nodeSet: Set<NodeId>
  edgeId?: EdgeId
}

type StoreSelectionCommands = Omit<SelectionCommands, 'selectAll'>

type SelectionStore = {
  source: ValueStore<StoredSelection>
  store: ReadStore<Selection>
  commands: StoreSelectionCommands
}

type SelectionReadDeps = {
  node: {
    item: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  }
}

export type Selection = {
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

const EMPTY_SELECTED_NODE_IDS: readonly NodeId[] = []
const EMPTY_SELECTED_NODE_SET = new Set<NodeId>()
const EMPTY_SELECTION: StoredSelection = {
  nodeIds: EMPTY_SELECTED_NODE_IDS,
  nodeSet: EMPTY_SELECTED_NODE_SET,
  edgeId: undefined
}
const EMPTY_NODES: readonly Node[] = []

const isSameNodeIdSet = (
  prev: ReadonlySet<NodeId>,
  next: ReadonlySet<NodeId>
) => {
  if (prev === next) return true
  if (prev.size !== next.size) return false

  for (const nodeId of prev) {
    if (!next.has(nodeId)) {
      return false
    }
  }

  return true
}

const createSelectionSource = (
  nodeSet: Set<NodeId>,
  edgeId?: EdgeId
): StoredSelection => {
  if (nodeSet.size === 0 && edgeId === undefined) {
    return EMPTY_SELECTION
  }

  return {
    nodeIds: nodeSet.size === 0 ? EMPTY_SELECTED_NODE_IDS : [...nodeSet],
    nodeSet,
    edgeId
  }
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

const isSelectionEqual = (
  left: Selection,
  right: Selection
) => (
  left.kind === right.kind
  && left.target.edgeId === right.target.edgeId
  && left.items.primary === right.items.primary
  && left.items.count === right.items.count
  && isOrderedArrayEqual(left.target.nodeIds, right.target.nodeIds)
  && isOrderedArrayEqual(left.items.nodes, right.items.nodes)
  && isRectEqual(left.box, right.box)
)

const resolveSelection = ({
  selection,
  readNode
}: {
  selection: StoredSelection
  readNode: (nodeId: NodeId) => NodeItem | undefined
}): Selection => {
  const items = readNodeItems(readNode, selection.nodeIds)
  const nodes = items.length > 0
    ? items.map((item) => item.node)
    : EMPTY_NODES
  const box = items.length > 0
    ? getBoundingRect(items.map((item) => item.rect))
    : undefined
  const count = nodes.length

  return {
    kind: selection.edgeId !== undefined
      ? 'edge'
      : count === 1
        ? 'node'
        : count > 1
          ? 'nodes'
          : 'none',
    target: {
      nodeIds: count > 0 ? selection.nodeIds : EMPTY_SELECTED_NODE_IDS,
      nodeSet: count > 0 ? selection.nodeSet : EMPTY_SELECTED_NODE_SET,
      edgeId: selection.edgeId
    },
    items: {
      nodes,
      primary: nodes[0],
      count
    },
    box
  }
}

export const createSelectionStore = ({
  read
}: {
  read: SelectionReadDeps
}): SelectionStore => {
  const source = createValueStore<StoredSelection>(EMPTY_SELECTION)
  const readSelection = () => source.get()
  const writeSelection = (next: StoredSelection) => {
    if (readSelection() === next) return
    source.set(next)
  }

  const store = createDerivedStore<Selection>({
    get: (readStore) => resolveSelection({
      selection: readStore(source),
      readNode: (nodeId) => readStore(read.node.item, nodeId)
    }),
    isEqual: isSelectionEqual
  })

  const select = (
    nodeIds: readonly NodeId[],
    mode: SelectionMode = 'replace'
  ) => {
    const current = readSelection()
    const nextNodeSet = applySelection(
      current.nodeSet,
      [...nodeIds],
      mode
    )

    if (
      current.edgeId === undefined
      && isSameNodeIdSet(current.nodeSet, nextNodeSet)
    ) {
      return
    }

    writeSelection(createSelectionSource(nextNodeSet, undefined))
  }

  const selectEdge = (edgeId?: EdgeId) => {
    const current = readSelection()

    if (edgeId === undefined) {
      if (current.edgeId === undefined) return
      writeSelection(createSelectionSource(current.nodeSet, undefined))
      return
    }

    if (current.edgeId === edgeId && current.nodeSet.size === 0) return
    writeSelection(createSelectionSource(new Set<NodeId>(), edgeId))
  }

  const clear = () => {
    const current = readSelection()
    if (current.nodeSet.size === 0 && current.edgeId === undefined) {
      return
    }
    writeSelection(EMPTY_SELECTION)
  }

  return {
    source,
    store,
    commands: {
      select,
      selectEdge,
      clear
    }
  }
}
