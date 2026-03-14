import { atom } from 'jotai'
import { atom as vanillaAtom } from 'jotai/vanilla'
import type { Point } from '@whiteboard/core/types'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import type { InternalWhiteboardInstance } from '../common/instance'
import type { Selection } from '../selection/domain'
import type { ContextMenuTarget } from './types'

const createSelection = (
  current: Pick<Selection, 'nodeIds' | 'edgeId'>
): Selection => {
  const nodeIds = current.nodeIds
  return {
    nodeIds,
    nodeIdSet: new Set(nodeIds),
    edgeId: current.edgeId
  }
}

export type ContextMenuState =
  | { open: false }
  | {
      open: true
      screen: Point
      target: ContextMenuTarget
      selectionBeforeOpen: Selection
    }

const CLOSED_CONTEXT_MENU: ContextMenuState = { open: false }

const contextMenuAtom = vanillaAtom<ContextMenuState>(CLOSED_CONTEXT_MENU)

export const contextMenuStateAtom = atom((get) => get(contextMenuAtom))

export type ContextMenuDomain = {
  state: {
    get: () => ContextMenuState
  }
  commands: {
    open: (payload: { screen: Point; target: ContextMenuTarget }) => void
    closeDismiss: () => void
    closeAction: () => void
  }
}

export const createContextMenuDomain = ({
  uiStore,
  readSelection,
  restoreSelection
}: {
  uiStore: InternalWhiteboardInstance['uiStore']
  readSelection: () => Selection
  restoreSelection: (selection: Selection) => void
}): ContextMenuDomain => ({
  state: {
    get: () => uiStore.get(contextMenuAtom)
  },
  commands: {
    open: (payload) => {
      uiStore.set(contextMenuAtom, {
        open: true,
        screen: payload.screen,
        target: payload.target,
        selectionBeforeOpen: createSelection(readSelection())
      })
    },
    closeDismiss: () => {
      const current = uiStore.get(contextMenuAtom)
      if (current.open) {
        restoreSelection(current.selectionBeforeOpen)
      }
      uiStore.set(contextMenuAtom, CLOSED_CONTEXT_MENU)
    },
    closeAction: () => {
      uiStore.set(contextMenuAtom, CLOSED_CONTEXT_MENU)
    }
  }
})

export const useContextMenuState = (): ContextMenuState =>
  useUiAtomValue(contextMenuStateAtom)
