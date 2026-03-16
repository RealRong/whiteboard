import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { NodeId } from '@whiteboard/core/types'
import { isSameRefOrder } from '@whiteboard/core/utils'
import { notifyListeners } from './subscriptions'
import type { ReadSnapshot } from './types'

export const createTreeProjection = (initialSnapshot: ReadSnapshot) => {
  const idsByRootId = new Map<NodeId, readonly NodeId[]>()
  const listenersByRootId = new Map<NodeId, Set<() => void>>()
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

  const ids = (rootId: NodeId): readonly NodeId[] => {
    const next = readIds(rootId, idsByRootId.get(rootId))
    idsByRootId.set(rootId, next)
    return next
  }

  const subscribe = (rootId: NodeId, listener: () => void) => {
    const listeners = listenersByRootId.get(rootId) ?? new Set<() => void>()
    if (!listenersByRootId.has(rootId)) {
      listenersByRootId.set(rootId, listeners)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) {
        listenersByRootId.delete(rootId)
        idsByRootId.delete(rootId)
      }
    }
  }

  const notifyRoot = (rootId: NodeId) => {
    const listeners = listenersByRootId.get(rootId)
    if (!listeners?.size) return
    notifyListeners(listeners)
  }

  const applyChange = (impact: KernelReadImpact, snapshot: ReadSnapshot) => {
    snapshotRef = snapshot

    if (!listenersByRootId.size) {
      return
    }

    if (impact.reset) {
      listenersByRootId.forEach((_, rootId) => {
        const prev = idsByRootId.get(rootId)
        const next = readIds(rootId, prev)
        idsByRootId.set(rootId, next)
        if (prev !== next) {
          notifyRoot(rootId)
        }
      })
      return
    }

    listenersByRootId.forEach((_, rootId) => {
      const prev = idsByRootId.get(rootId)
      const next = readIds(rootId, prev)
      idsByRootId.set(rootId, next)
      if (prev !== next) {
        notifyRoot(rootId)
      }
    })
  }

  return {
    get: ids,
    ids,
    subscribe,
    applyChange
  }
}
