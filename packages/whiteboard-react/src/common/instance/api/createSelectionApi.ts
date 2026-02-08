import type { WhiteboardApi } from 'types/api'
import type { WhiteboardInstance } from 'types/instance'
import { edgeSelectionAtom, nodeSelectionAtom } from '../../state'
import { applySelection } from '../state/selectionState'
import { setStoreAtom } from '../store/setStoreAtom'

export const createSelectionApi = (instance: WhiteboardInstance): WhiteboardApi['selection'] => {
  const { store } = instance.state

  return {
    select: (ids, mode = 'replace') => {
      setStoreAtom(store, edgeSelectionAtom, undefined)
      setStoreAtom(store, nodeSelectionAtom, (prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
      }))
    },
    toggle: (ids) => {
      setStoreAtom(store, edgeSelectionAtom, undefined)
      setStoreAtom(store, nodeSelectionAtom, (prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    clear: () => {
      setStoreAtom(store, edgeSelectionAtom, undefined)
      setStoreAtom(store, nodeSelectionAtom, (prev) => ({
        ...prev,
        selectedNodeIds: new Set(),
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    },
    getSelectedNodeIds: () => Array.from(store.get(nodeSelectionAtom).selectedNodeIds),
    beginBox: (mode = 'replace') => {
      setStoreAtom(store, edgeSelectionAtom, undefined)
      setStoreAtom(store, nodeSelectionAtom, (prev) => ({
        ...prev,
        mode,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    },
    updateBox: (selectionRect, selectionRectWorld) => {
      setStoreAtom(store, nodeSelectionAtom, (prev) => ({
        ...prev,
        isSelecting: true,
        selectionRect,
        selectionRectWorld
      }))
    },
    endBox: () => {
      setStoreAtom(store, nodeSelectionAtom, (prev) => ({
        ...prev,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    }
  }
}
