import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'

export type { SelectionMode } from '@whiteboard/core/node'

export type WhiteboardSelectionCommands = {
  select: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
  selectEdge: (edgeId?: EdgeId) => void
  selectAll: () => void
  clear: () => void
}

export type WhiteboardSelectionRead = {
  nodeIds: () => readonly NodeId[]
  edgeId: () => EdgeId | undefined
}

export type StoredSelection = {
  nodeIds: readonly NodeId[]
  nodeIdSet: Set<NodeId>
  edgeId?: EdgeId
}

type SelectionDomain = {
  store: ValueStore<StoredSelection>
  read: WhiteboardSelectionRead
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

export const createSelectionDomain = ({
  readAllNodeIds = () => []
}: {
  readAllNodeIds?: () => readonly NodeId[]
}): SelectionDomain => {
  const store = createValueStore<StoredSelection>(EMPTY_SELECTION)
  const readSelection = () => store.get()
  const writeSelection = (next: StoredSelection) => {
    if (readSelection() === next) return
    store.set(next)
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
    store,
    read: {
      nodeIds: () => readSelection().nodeIds,
      edgeId: () => readSelection().edgeId
    },
    commands: {
      select,
      selectEdge,
      selectAll: () => select(readAllNodeIds()),
      clear
    }
  }
}
