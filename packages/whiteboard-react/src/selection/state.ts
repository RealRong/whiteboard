import type { createStore } from 'jotai/vanilla'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { WhiteboardSelectionState } from './types'
import {
  createInitialSelectionState,
  selectionAtom,
  type EditorSelectionState
} from './uiState'

const subscribeListener = (
  listeners: Set<() => void>,
  listener: () => void
) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const ensureNodeListeners = (
  listenersById: Map<NodeId, Set<() => void>>,
  nodeId: NodeId
) => {
  const listeners = listenersById.get(nodeId)
  if (listeners) return listeners
  const next = new Set<() => void>()
  listenersById.set(nodeId, next)
  return next
}

const notify = (listeners: ReadonlySet<() => void>) => {
  listeners.forEach((listener) => {
    listener()
  })
}

const collectChangedNodeIds = (
  prev: EditorSelectionState,
  next: EditorSelectionState
): NodeId[] => {
  const changed = new Set<NodeId>()

  prev.selectedNodeIds.forEach((nodeId) => {
    if (!next.selectedNodeIds.has(nodeId)) {
      changed.add(nodeId)
    }
  })

  next.selectedNodeIds.forEach((nodeId) => {
    if (!prev.selectedNodeIds.has(nodeId)) {
      changed.add(nodeId)
    }
  })

  return [...changed]
}

export const createSelectionState = ({
  uiStore
}: {
  uiStore: ReturnType<typeof createStore>
}): {
  selection: WhiteboardSelectionState
  dispose: () => void
} => {
  let snapshot = uiStore.get(selectionAtom)
  const listeners = new Set<() => void>()
  const nodeListenersById = new Map<NodeId, Set<() => void>>()
  const edgeListeners = new Set<() => void>()

  const notifyNode = (nodeId: NodeId) => {
    const nodeListeners = nodeListenersById.get(nodeId)
    if (!nodeListeners?.size) return
    notify(nodeListeners)
  }

  const off = uiStore.sub(selectionAtom, () => {
    const next = uiStore.get(selectionAtom)
    const prev = snapshot
    if (prev === next) return
    snapshot = next

    notify(listeners)

    collectChangedNodeIds(prev, next).forEach((nodeId) => {
      notifyNode(nodeId)
    })

    if (prev.selectedEdgeId !== next.selectedEdgeId) {
      notify(edgeListeners)
    }
  })

  return {
    selection: {
      get: () => snapshot,
      contains: (nodeId: NodeId) => snapshot.selectedNodeIds.has(nodeId),
      selectedEdgeId: () => snapshot.selectedEdgeId,
      subscribe: (listener) => subscribeListener(listeners, listener),
      subscribeNode: (nodeId, listener) => {
        const nodeListeners = ensureNodeListeners(nodeListenersById, nodeId)
        nodeListeners.add(listener)
        return () => {
          nodeListeners.delete(listener)
          if (!nodeListeners.size) {
            nodeListenersById.delete(nodeId)
          }
        }
      },
      subscribeEdge: (listener) => subscribeListener(edgeListeners, listener)
    },
    dispose: () => {
      off()
      snapshot = createInitialSelectionState()
      listeners.clear()
      nodeListenersById.clear()
      edgeListeners.clear()
    }
  }
}
