import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { NodeItem } from '@whiteboard/core/read'
import type { Node, NodeId } from '@whiteboard/core/types'
import { notifyListeners, subscribeListener } from './subscriptions'
import type { ReadSnapshot } from './types'

// Defensive fallback: index should have rects after applyChange syncs.
const readRect = (
  snapshot: ReadSnapshot,
  node: Node,
  nodeId: NodeId
) => snapshot.indexes.node.get(nodeId)?.rect ?? {
  x: node.position.x,
  y: node.position.y,
  width: node.size?.width ?? 0,
  height: node.size?.height ?? 0
}

export const createNodeProjection = (initialSnapshot: ReadSnapshot) => {
  const entryById = new Map<NodeId, NodeItem>()
  const listenersById = new Map<NodeId, Set<() => void>>()
  const idsListeners = new Set<() => void>()
  let snapshotRef: ReadSnapshot = initialSnapshot
  let idsRef = initialSnapshot.model.indexes.canvasNodeIds as readonly NodeId[]

  const getNodeMap = () => snapshotRef.model.indexes.canvasNodeById

  const readEntry = (
    nodeId: NodeId,
    previous?: NodeItem
  ) => {
    const node = getNodeMap().get(nodeId)
    if (!node) {
      return undefined
    }

    const rect = readRect(snapshotRef, node, nodeId)
    if (previous && previous.node === node && previous.rect === rect) {
      return previous
    }

    return {
      node,
      rect
    } satisfies NodeItem
  }

  const get = (nodeId: NodeId) => {
    const next = readEntry(nodeId, entryById.get(nodeId))
    if (!next) {
      entryById.delete(nodeId)
      return undefined
    }
    entryById.set(nodeId, next)
    return next
  }

  const subscribe = (nodeId: NodeId, listener: () => void) => {
    const nodeListeners = listenersById.get(nodeId) ?? new Set<() => void>()
    if (!listenersById.has(nodeId)) {
      listenersById.set(nodeId, nodeListeners)
    }
    nodeListeners.add(listener)
    return () => {
      nodeListeners.delete(listener)
      if (!nodeListeners.size) {
        listenersById.delete(nodeId)
      }
    }
  }

  const notifyNode = (nodeId: NodeId) => {
    const nodeListeners = listenersById.get(nodeId)
    if (!nodeListeners?.size) return
    notifyListeners(nodeListeners)
  }

  const ids = () => idsRef

  const subscribeIds = (listener: () => void) => subscribeListener(idsListeners, listener)

  const applyChange = (impact: KernelReadImpact, snapshot: ReadSnapshot) => {
    snapshotRef = snapshot
    const prevIds = idsRef
    const nextIds = snapshotRef.model.indexes.canvasNodeIds as readonly NodeId[]
    const idsChanged = prevIds !== nextIds
    idsRef = nextIds

    if (idsChanged) {
      notifyListeners(idsListeners)
    }

    const changedNodeIds = new Set<NodeId>()

    if (
      impact.reset
      || impact.node.list
      || ((impact.node.geometry || impact.node.value) && impact.node.ids.length === 0)
    ) {
      listenersById.forEach((_, nodeId) => {
        changedNodeIds.add(nodeId)
      })
    } else {
      impact.node.ids.forEach((nodeId) => {
        changedNodeIds.add(nodeId)
      })
    }

    if (idsChanged) {
      prevIds.forEach((nodeId) => {
        if (!snapshotRef.model.indexes.canvasNodeById.has(nodeId)) {
          changedNodeIds.add(nodeId)
        }
      })
    }

    const prevEntries = new Map<NodeId, NodeItem | undefined>()
    const nextEntries = new Map<NodeId, NodeItem | undefined>()

    changedNodeIds.forEach((nodeId) => {
      const prevEntry = entryById.get(nodeId)
      prevEntries.set(nodeId, prevEntry)
      nextEntries.set(nodeId, readEntry(nodeId, prevEntry))
    })

    changedNodeIds.forEach((nodeId) => {
      const prevEntry = prevEntries.get(nodeId)
      const nextEntry = nextEntries.get(nodeId)
      if (nextEntry) {
        entryById.set(nodeId, nextEntry)
      } else {
        entryById.delete(nodeId)
      }
      if (prevEntry === nextEntry) return
      notifyNode(nodeId)
    })
  }

  return {
    ids,
    get,
    subscribe,
    subscribeIds,
    applyChange
  }
}
