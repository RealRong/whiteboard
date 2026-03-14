import { atom, type Atom } from 'jotai'
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

export const selectedNodeIdsAtom = atom((get) => get(selectionAtom).nodeIds)
export const selectedEdgeIdAtom = atom((get) => get(selectionAtom).edgeId)

export const createSelectionContainsAtom = (nodeId: NodeId): Atom<boolean> =>
  atom((get) => get(selectionStateAtom).nodeIdSet.has(nodeId))

export const createSelectionDomain = ({
  uiStore,
  readAllNodeIds = () => []
}: {
  uiStore: SelectionStore
  readAllNodeIds?: () => readonly NodeId[]
}): SelectionDomain => {
  const readSelection = () => uiStore.get(selectionStateAtom)
  const writeSelection = (next: StoredSelection) => {
    uiStore.set(selectionStateAtom, next)
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
      selectedEdgeId: () => readSelection().edgeId
    },
    commands: {
      select,
      selectEdge,
      selectAll: () => select(readAllNodeIds()),
      clear
    }
  }
}
