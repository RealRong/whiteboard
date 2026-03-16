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

type ContainerReadDeps = {
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

export type ContainerCommands = {
  enter: (nodeId: NodeId) => void
  exit: () => void
  clear: () => void
}

export type Container = {
  id?: NodeId
  ids: readonly NodeId[]
  set?: ReadonlySet<NodeId>
}

type ContainerStore = {
  source: ValueStore<NodeId | undefined>
  store: ReadStore<Container>
  commands: ContainerCommands
}

const EMPTY_IDS: readonly NodeId[] = []
const EMPTY_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const ROOT_CONTAINER: Container = {
  ids: EMPTY_IDS
}

const isContainerEqual = (
  left: Container,
  right: Container
) => (
  left.id === right.id
  && isOrderedArrayEqual(left.ids, right.ids)
)

export const createContainerStore = (
  read: ContainerReadDeps
): ContainerStore => {
  const source = createValueStore<NodeId | undefined>(undefined)

  const store = createDerivedStore<Container>({
    get: (readStore) => {
      const current = readStore(source)
      if (!current) {
        return ROOT_CONTAINER
      }

      const entry = readStore(read.node.item, current)
      if (!entry?.node) {
        return ROOT_CONTAINER
      }

      const ids = readStore(read.tree, current)
      return {
        id: current,
        ids,
        set: ids.length > 0 ? new Set(ids) : EMPTY_SET
      }
    },
    isEqual: isContainerEqual
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

export const hasContainerNode = (
  container: Container,
  nodeId: NodeId
): boolean => (
  container.id
    ? Boolean(container.set?.has(nodeId))
    : true
)

export const filterContainerNodeIds = (
  container: Container,
  nodeIds: readonly NodeId[]
): readonly NodeId[] => (
  container.id
    ? nodeIds.filter((nodeId) => hasContainerNode(container, nodeId))
    : nodeIds
)

export const hasContainerEdge = (
  container: Container,
  edge: Pick<Edge, 'source' | 'target'>
): boolean => (
  hasContainerNode(container, edge.source.nodeId)
  && hasContainerNode(container, edge.target.nodeId)
)
