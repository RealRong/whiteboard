import type { FrameScope } from '@whiteboard/core/document'
import {
  ROOT_FRAME_SCOPE,
  createFrameScope,
  isFrameScopeEqual
} from '@whiteboard/core/document'
import type {
  EdgeId,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import {
  createDerivedStore,
  createValueStore,
  type KeyedReadStore,
  type ReadStore,
  type ValueStore
} from '@whiteboard/engine'
import type { EdgeItem, NodeItem } from '@whiteboard/engine'

type FrameReadDeps = {
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

export type FrameCommands = {
  enter: (nodeId: NodeId) => void
  exit: () => void
  clear: () => void
}

export type FrameState = {
  source: ValueStore<NodeId | undefined>
  store: ReadStore<FrameScope>
  commands: FrameCommands
}

export const createFrameState = (
  read: FrameReadDeps
): FrameState => {
  const source = createValueStore<NodeId | undefined>(undefined)

  const store = createDerivedStore<FrameScope>({
    get: (readStore) => {
      const current = readStore(source)
      if (!current) {
        return ROOT_FRAME_SCOPE
      }

      const entry = readStore(read.node.item, current)
      if (!entry?.node) {
        return ROOT_FRAME_SCOPE
      }

      return createFrameScope(current, readStore(read.tree, current))
    },
    isEqual: isFrameScopeEqual
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
