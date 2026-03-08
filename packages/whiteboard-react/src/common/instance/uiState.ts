import { atom } from 'jotai/vanilla'
import { applySelection } from '@whiteboard/core/node'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type EditorTool = 'select' | 'edge'
export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type EditorSelectionState = {
  selectedNodeIds: Set<NodeId>
  selectedEdgeId?: EdgeId
  mode: SelectionMode
}

export type EditorInteractionState = {
  focus: {
    isEditingText: boolean
    isInputFocused: boolean
    isImeComposing: boolean
  }
  pointer: {
    isDragging: boolean
    button?: 0 | 1 | 2
    modifiers: {
      alt: boolean
      shift: boolean
      ctrl: boolean
      meta: boolean
    }
  }
  hover: {
    nodeId?: NodeId
    edgeId?: EdgeId
  }
}

export const createInitialSelectionState = (): EditorSelectionState => ({
  selectedNodeIds: new Set<NodeId>(),
  selectedEdgeId: undefined,
  mode: 'replace'
})

export const createInitialInteractionState = (): EditorInteractionState => ({
  focus: {
    isEditingText: false,
    isInputFocused: false,
    isImeComposing: false
  },
  pointer: {
    isDragging: false,
    button: undefined,
    modifiers: {
      alt: false,
      shift: false,
      ctrl: false,
      meta: false
    }
  },
  hover: {
    nodeId: undefined,
    edgeId: undefined
  }
})

export const toolAtom = atom<EditorTool>('select')
export const selectionAtom = atom<EditorSelectionState>(createInitialSelectionState())
export const interactionAtom = atom<EditorInteractionState>(createInitialInteractionState())

export const uiStateAtoms = {
  tool: toolAtom,
  selection: selectionAtom,
  interaction: interactionAtom
}

export const mergeInteraction = (
  prev: EditorInteractionState,
  patch: Partial<EditorInteractionState>
): EditorInteractionState => ({
  ...prev,
  ...patch,
  focus: patch.focus ? { ...prev.focus, ...patch.focus } : prev.focus,
  pointer: patch.pointer
    ? {
      ...prev.pointer,
      ...patch.pointer,
      modifiers: patch.pointer.modifiers
        ? { ...prev.pointer.modifiers, ...patch.pointer.modifiers }
        : prev.pointer.modifiers
    }
    : prev.pointer,
  hover: patch.hover ? { ...prev.hover, ...patch.hover } : prev.hover
})

export const applySelectionState = (
  prev: EditorSelectionState,
  ids: readonly NodeId[],
  mode: SelectionMode
): EditorSelectionState => ({
  ...prev,
  selectedEdgeId: undefined,
  mode,
  selectedNodeIds: applySelection(prev.selectedNodeIds, [...ids], mode)
})
