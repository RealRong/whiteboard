import { atom } from 'jotai'
import { atom as vanillaAtom } from 'jotai/vanilla'
import type { createStore } from 'jotai/vanilla'
import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type { SelectionMode } from '@whiteboard/core/node'

export type WhiteboardSelectionCommands = {
  select: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
  selectEdge: (edgeId?: EdgeId) => void
  selectAll: () => void
  clear: () => void
}

type SelectionStore = ReturnType<typeof createStore>

export type Selection = {
  nodeIds: readonly NodeId[]
  nodeIdSet: ReadonlySet<NodeId>
  edgeId?: EdgeId
}

type StoredSelection = {
  nodeIds: readonly NodeId[]
  nodeIdSet: Set<NodeId>
  edgeId?: EdgeId
}

type SelectionDomain = {
  state: {
    selectedNodeIds: () => readonly NodeId[]
    selectedEdgeId: () => EdgeId | undefined
    contains: (nodeId: NodeId) => boolean
    subscribe: (listener: () => void) => () => void
    subscribeNode: (nodeId: NodeId, listener: () => void) => () => void
    subscribeEdge: (listener: () => void) => () => void
  }
  commands: WhiteboardSelectionCommands
}

const EMPTY_SELECTED_NODE_IDS: readonly NodeId[] = []
const EMPTY_SELECTED_NODE_SET = new Set<NodeId>()
const EMPTY_SELECTION: StoredSelection = {
  nodeIds: EMPTY_SELECTED_NODE_IDS,
  nodeIdSet: EMPTY_SELECTED_NODE_SET,
  edgeId: undefined
}

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

const createSelectionState = (
  nodeIdSet: Set<NodeId>,
  edgeId?: EdgeId
): StoredSelection => {
  if (nodeIdSet.size === 0 && edgeId === undefined) {
    return EMPTY_SELECTION
  }

  return {
    nodeIds: nodeIdSet.size === 0 ? EMPTY_SELECTED_NODE_IDS : [...nodeIdSet],
    nodeIdSet,
    edgeId
  }
}

const selectionStateAtom = vanillaAtom<StoredSelection>(EMPTY_SELECTION)

export const selectionAtom = atom((get): Selection => get(selectionStateAtom))

export const createSelectionDomain = ({
  uiStore,
  readAllNodeIds = () => []
}: {
  uiStore: SelectionStore
  readAllNodeIds?: () => readonly NodeId[]
}): SelectionDomain => {
  const nodeListeners = new Map<NodeId, Set<() => void>>()
  const edgeListeners = new Set<() => void>()
  const readSelection = () => uiStore.get(selectionStateAtom)
  const notifyNode = (nodeId: NodeId) => {
    const listeners = nodeListeners.get(nodeId)
    if (!listeners) return
    listeners.forEach((listener) => {
      listener()
    })
  }
  const notifyEdge = () => {
    edgeListeners.forEach((listener) => {
      listener()
    })
  }
  const writeSelection = (next: StoredSelection) => {
    const prev = readSelection()
    if (prev === next) return
    uiStore.set(selectionStateAtom, next)
    if (prev.edgeId !== next.edgeId) {
      notifyEdge()
    }

    const visited = new Set<NodeId>()
    prev.nodeIdSet.forEach((nodeId) => {
      visited.add(nodeId)
      if (!next.nodeIdSet.has(nodeId)) {
        notifyNode(nodeId)
      }
    })
    next.nodeIdSet.forEach((nodeId) => {
      if (visited.has(nodeId)) return
      if (!prev.nodeIdSet.has(nodeId)) {
        notifyNode(nodeId)
      }
    })
  }
  const select = (
    nodeIds: readonly NodeId[],
    mode: SelectionMode = 'replace'
  ) => {
    const current = readSelection()
    const nextNodeIdSet = applySelection(
      current.nodeIdSet,
      [...nodeIds],
      mode
    )

    if (
      current.edgeId === undefined
      && isSameNodeIdSet(current.nodeIdSet, nextNodeIdSet)
    ) {
      return
    }

    writeSelection(createSelectionState(nextNodeIdSet, undefined))
  }
  const selectEdge = (edgeId?: EdgeId) => {
    const current = readSelection()

    if (edgeId === undefined) {
      if (current.edgeId === undefined) return
      writeSelection(createSelectionState(current.nodeIdSet, undefined))
      return
    }

    if (current.edgeId === edgeId && current.nodeIdSet.size === 0) return
    writeSelection(createSelectionState(new Set<NodeId>(), edgeId))
  }
  const clear = () => {
    const current = readSelection()
    if (current.nodeIdSet.size === 0 && current.edgeId === undefined) {
      return
    }
    writeSelection(EMPTY_SELECTION)
  }

  return {
    state: {
      selectedNodeIds: () => readSelection().nodeIds,
      selectedEdgeId: () => readSelection().edgeId,
      contains: (nodeId) => readSelection().nodeIdSet.has(nodeId),
      subscribe: (listener) => uiStore.sub(selectionStateAtom, listener),
      subscribeNode: (nodeId, listener) => {
        let listeners = nodeListeners.get(nodeId)
        if (!listeners) {
          listeners = new Set()
          nodeListeners.set(nodeId, listeners)
        }
        listeners.add(listener)
        return () => {
          const current = nodeListeners.get(nodeId)
          if (!current) return
          current.delete(listener)
          if (current.size === 0) {
            nodeListeners.delete(nodeId)
          }
        }
      },
      subscribeEdge: (listener) => {
        edgeListeners.add(listener)
        return () => {
          edgeListeners.delete(listener)
        }
      }
    },
    commands: {
      select,
      selectEdge,
      selectAll: () => select(readAllNodeIds()),
      clear
    }
  }
}
