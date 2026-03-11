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

type SelectionState = {
  selectedNodeIds: Set<NodeId>
  selectedEdgeId?: EdgeId
}

type SelectionDomain = {
  state: {
    nodeIds: () => readonly NodeId[]
    edgeId: () => EdgeId | undefined
  }
  commands: WhiteboardSelectionCommands
}

const createEmptySelectionState = (): SelectionState => ({
  selectedNodeIds: new Set<NodeId>()
})

const selectionAtom = vanillaAtom<SelectionState>(createEmptySelectionState())

export const selectedEdgeIdAtom = atom((get) => get(selectionAtom).selectedEdgeId)

export const createSelectionContainsAtom = (nodeId: NodeId): Atom<boolean> =>
  atom((get) => get(selectionAtom).selectedNodeIds.has(nodeId))

export const createSelectionDomain = ({
  uiStore,
  readAllNodeIds = () => []
}: {
  uiStore: SelectionStore
  readAllNodeIds?: () => readonly NodeId[]
}): SelectionDomain => {
  const readSelection = () => uiStore.get(selectionAtom)
  const writeSelection = (next: SelectionState) => {
    uiStore.set(selectionAtom, next)
  }
  const select = (
    nodeIds: readonly NodeId[],
    mode: SelectionMode = 'replace'
  ) => {
    const current = readSelection()
    writeSelection({
      selectedNodeIds: applySelection(current.selectedNodeIds, [...nodeIds], mode),
      selectedEdgeId: undefined
    })
  }
  const selectEdge = (edgeId?: EdgeId) => {
    const current = readSelection()

    if (edgeId === undefined) {
      if (current.selectedEdgeId === undefined) return
      writeSelection({
        ...current,
        selectedEdgeId: undefined
      })
      return
    }

    if (current.selectedEdgeId === edgeId && current.selectedNodeIds.size === 0) return
    writeSelection({
      selectedNodeIds: new Set<NodeId>(),
      selectedEdgeId: edgeId
    })
  }
  const clear = () => {
    writeSelection(createEmptySelectionState())
  }

  return {
    state: {
      nodeIds: () => [...readSelection().selectedNodeIds],
      edgeId: () => readSelection().selectedEdgeId
    },
    commands: {
      select,
      selectEdge,
      selectAll: () => select(readAllNodeIds()),
      clear
    }
  }
}
