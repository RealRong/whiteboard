import { atom } from 'jotai'
import { atom as vanillaAtom } from 'jotai/vanilla'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import type { InternalWhiteboardInstance } from '../common/instance'
import type { NodeToolbarMenuKey } from './model'

export type NodeToolbarMenuState =
  | { open: false }
  | {
      open: true
      key: NodeToolbarMenuKey
    }

const CLOSED_NODE_TOOLBAR_MENU: NodeToolbarMenuState = { open: false }

const nodeToolbarMenuAtom = vanillaAtom<NodeToolbarMenuState>(CLOSED_NODE_TOOLBAR_MENU)

export const nodeToolbarMenuStateAtom = atom((get) => get(nodeToolbarMenuAtom))

export type NodeToolbarMenuDomain = {
  state: {
    get: () => NodeToolbarMenuState
  }
  commands: {
    open: (key: NodeToolbarMenuKey) => void
    toggle: (key: NodeToolbarMenuKey) => void
    close: () => void
  }
}

export const createNodeToolbarMenuDomain = ({
  uiStore
}: {
  uiStore: InternalWhiteboardInstance['uiStore']
}): NodeToolbarMenuDomain => ({
  state: {
    get: () => uiStore.get(nodeToolbarMenuAtom)
  },
  commands: {
    open: (key) => {
      uiStore.set(nodeToolbarMenuAtom, {
        open: true,
        key
      })
    },
    toggle: (key) => {
      const current = uiStore.get(nodeToolbarMenuAtom)
      uiStore.set(
        nodeToolbarMenuAtom,
        current.open && current.key === key
          ? CLOSED_NODE_TOOLBAR_MENU
          : { open: true, key }
      )
    },
    close: () => {
      uiStore.set(nodeToolbarMenuAtom, CLOSED_NODE_TOOLBAR_MENU)
    }
  }
})

export const useNodeToolbarMenuState = (): NodeToolbarMenuState =>
  useUiAtomValue(nodeToolbarMenuStateAtom)
