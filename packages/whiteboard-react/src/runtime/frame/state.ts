import {
  createDerivedStore,
  createValueStore,
  type KeyedReadStore,
  type ReadStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import type {
  Edge,
  EdgeId,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import { isNodeEdgeEnd } from '@whiteboard/core/types'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import { isOrderedArrayEqual } from '../utils/equality'

type ReadDeps = {
  node: {
    item: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  }
  edge: {
    item: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  }
  tree: KeyedReadStore<NodeId, readonly NodeId[]>
  index: {
    node: {
      get: (nodeId: NodeId) => {
        rect: Rect
      } | undefined
    }
  }
}

export type Commands = {
  enter: (nodeId: NodeId) => void
  exit: () => void
  clear: () => void
}

export type FrameScope = {
  id?: NodeId
  ids: readonly NodeId[]
  set?: ReadonlySet<NodeId>
}

type Store = {
  source: ValueStore<NodeId | undefined>
  store: ReadStore<FrameScope>
  commands: Commands
}

const EMPTY_IDS: readonly NodeId[] = []
const EMPTY_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const ROOT: FrameScope = {
  ids: EMPTY_IDS
}

const isEqual = (
  left: FrameScope,
  right: FrameScope
) => (
  left.id === right.id
  && isOrderedArrayEqual(left.ids, right.ids)
)

export const createState = (
  read: ReadDeps
): Store => {
  const source = createValueStore<NodeId | undefined>(undefined)

  const store = createDerivedStore<FrameScope>({
    get: (readStore) => {
      const current = readStore(source)
      if (!current) {
        return ROOT
      }

      const entry = readStore(read.node.item, current)
      if (!entry?.node) {
        return ROOT
      }

      const ids = readStore(read.tree, current)
      return {
        id: current,
        ids,
        set: ids.length > 0 ? new Set(ids) : EMPTY_SET
      }
    },
    isEqual
  })

  const write = (next?: NodeId) => {
    if (source.get() === next) {
      return
    }
    source.set(next)
  }

  const clear = () => {
    write(undefined)
  }

  return {
    source,
    store,
    commands: {
      enter: write,
      exit: clear,
      clear
    }
  }
}

export const hasNode = (
  frame: FrameScope,
  nodeId: NodeId
): boolean => (
  frame.id
    ? Boolean(frame.set?.has(nodeId))
    : true
)

export const filterNodeIds = (
  frame: FrameScope,
  nodeIds: readonly NodeId[]
): readonly NodeId[] => (
  frame.id
    ? nodeIds.filter((nodeId) => hasNode(frame, nodeId))
    : nodeIds
)

export const hasEdge = (
  frame: FrameScope,
  edge: Pick<Edge, 'source' | 'target'>
): boolean => {
  if (!frame.id) {
    return true
  }

  const hasNodeEnd =
    isNodeEdgeEnd(edge.source)
    || isNodeEdgeEnd(edge.target)

  if (!hasNodeEnd) {
    return false
  }

  return (
    (!isNodeEdgeEnd(edge.source) || hasNode(frame, edge.source.nodeId))
    && (!isNodeEdgeEnd(edge.target) || hasNode(frame, edge.target.nodeId))
  )
}
