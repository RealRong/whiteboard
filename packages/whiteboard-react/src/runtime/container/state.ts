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

export type Container = {
  id?: NodeId
  ids: readonly NodeId[]
  set?: ReadonlySet<NodeId>
}

type Store = {
  source: ValueStore<NodeId | undefined>
  store: ReadStore<Container>
  commands: Commands
}

const EMPTY_IDS: readonly NodeId[] = []
const EMPTY_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const ROOT: Container = {
  ids: EMPTY_IDS
}

const isEqual = (
  left: Container,
  right: Container
) => (
  left.id === right.id
  && isOrderedArrayEqual(left.ids, right.ids)
)

export const createState = (
  read: ReadDeps
): Store => {
  const source = createValueStore<NodeId | undefined>(undefined)

  const store = createDerivedStore<Container>({
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
  container: Container,
  nodeId: NodeId
): boolean => (
  container.id
    ? Boolean(container.set?.has(nodeId))
    : true
)

export const filterNodeIds = (
  container: Container,
  nodeIds: readonly NodeId[]
): readonly NodeId[] => (
  container.id
    ? nodeIds.filter((nodeId) => hasNode(container, nodeId))
    : nodeIds
)

export const hasEdge = (
  container: Container,
  edge: Pick<Edge, 'source' | 'target'>
): boolean => (
  hasNode(container, edge.source.nodeId)
  && hasNode(container, edge.target.nodeId)
)
