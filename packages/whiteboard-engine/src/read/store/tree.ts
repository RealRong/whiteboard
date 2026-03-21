import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { NodeId } from '@whiteboard/core/types'
import { isSameRefOrder } from '@whiteboard/core/utils'
import type { ReadSnapshot } from './types'
import { createTrackedRead } from './tracked'

const EMPTY_NODE_IDS: readonly NodeId[] = []

export const createTreeProjection = (initialSnapshot: ReadSnapshot) => {
  const cacheByRootId = new Map<NodeId, readonly NodeId[]>()
  const tracked = createTrackedRead<NodeId, readonly NodeId[]>({
    emptyValue: EMPTY_NODE_IDS,
    read: (rootId) => readCached(rootId)
  })
  let snapshotRef: ReadSnapshot = initialSnapshot

  const readIds = (
    rootId: NodeId,
    previous?: readonly NodeId[]
  ): readonly NodeId[] => {
    const next = snapshotRef.indexes.tree.list(rootId)
    return previous && isSameRefOrder(previous, next)
      ? previous
      : next
  }

  const readCached = (
    rootId: NodeId
  ) => {
    const next = readIds(rootId, cacheByRootId.get(rootId))
    cacheByRootId.set(rootId, next)
    return next
  }

  const applyChange = (
    _impact: KernelReadImpact,
    snapshot: ReadSnapshot
  ) => {
    snapshotRef = snapshot

    if (!tracked.size()) {
      return
    }
    tracked.sync(tracked.keys())
  }

  return {
    item: tracked.item,
    applyChange
  }
}
