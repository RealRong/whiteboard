import { contextMenuStateAtom, type ContextMenuState } from '../../ui/chrome/context-menu/domain'
import { readContextMenuView } from '../../ui/chrome/context-menu/view'
import type { ContextMenuSection, ContextMenuView } from '../../ui/chrome/context-menu/types'
import { selectionAtom, type Selection } from '../state/selection'
import type { NodeToolbarItem } from '../../ui/chrome/toolbar/model'
import { readNodeToolbarView } from '../../ui/chrome/toolbar/view'
import { nodeToolbarMenuStateAtom } from '../../ui/chrome/toolbar/domain'
import type { InternalWhiteboardInstance } from '../instance/types'
import {
  isOptionalEqual,
  isOrderedArrayEqual
} from '../utils/equality'
import {
  combineUnsubscribers,
  EMPTY_UNSUBSCRIBE,
  subscribeNodeIds,
  subscribeOptionalNode
} from './shared'
import type {
  ParameterizedView,
  SurfaceToolbarView,
  SurfaceView
} from './types'

export const readSurfaceView = ({
  instance,
  containerWidth,
  containerHeight
}: {
  instance: InternalWhiteboardInstance
  containerWidth: number
  containerHeight: number
}): SurfaceView => {
  const toolbar = readNodeToolbarView(instance)
  const toolbarMenu = instance.state.surface.getToolbarMenu()
  const contextMenuState = instance.state.surface.getContextMenu()

  return {
    toolbar: toolbar
      ? {
          ...toolbar,
          activeMenuKey: toolbarMenu.open ? toolbarMenu.key : undefined
        }
      : undefined,
    contextMenu: readContextMenuView({
      instance,
      state: contextMenuState,
      containerWidth,
      containerHeight
    })
  }
}

const isSameToolbarItems = (
  left: readonly NodeToolbarItem[],
  right: readonly NodeToolbarItem[]
) => isOrderedArrayEqual(left, right, (item, next) => (
  item.key === next.key
  && item.label === next.label
  && item.active === next.active
  && item.menuKey === next.menuKey
  && item.run === next.run
  && item.icon === next.icon
))

const isSameToolbarView = (
  left: SurfaceToolbarView | undefined,
  right: SurfaceToolbarView | undefined
) => isOptionalEqual(left, right, (leftView, rightView) => (
  leftView.activeMenuKey === rightView.activeMenuKey
  && leftView.primaryNode === rightView.primaryNode
  && leftView.primarySchema === rightView.primarySchema
  && leftView.placement === rightView.placement
  && leftView.anchor.x === rightView.anchor.x
  && leftView.anchor.y === rightView.anchor.y
  && isOrderedArrayEqual(leftView.nodes, rightView.nodes)
  && isSameToolbarItems(leftView.items, rightView.items)
))

const isSameContextMenuItems = (
  left: ContextMenuSection['items'],
  right: ContextMenuSection['items']
) => isOrderedArrayEqual(left, right, (item, next) => (
  item.key === next.key
  && item.label === next.label
  && item.disabled === next.disabled
  && item.tone === next.tone
  && item.run === next.run
))

const isSameContextMenuSections = (
  left: readonly ContextMenuSection[],
  right: readonly ContextMenuSection[]
) => isOrderedArrayEqual(left, right, (section, next) => (
  section.key === next.key
  && section.title === next.title
  && isSameContextMenuItems(section.items, next.items)
))

const isSameContextMenuView = (
  left: ContextMenuView | undefined,
  right: ContextMenuView | undefined
) => isOptionalEqual(left, right, (leftView, rightView) => (
  leftView.placement.left === rightView.placement.left
  && leftView.placement.top === rightView.placement.top
  && leftView.placement.transform === rightView.placement.transform
  && isSameContextMenuSections(leftView.sections, rightView.sections)
))

export const isSurfaceViewEqual = (
  left: SurfaceView,
  right: SurfaceView
) => (
  isSameToolbarView(left.toolbar, right.toolbar)
  && isSameContextMenuView(left.contextMenu, right.contextMenu)
)

export const createSurfaceView = (
  getInstance: () => InternalWhiteboardInstance
): ParameterizedView<{
  containerWidth: number
  containerHeight: number
}, SurfaceView> => ({
  get: (args) => readSurfaceView({
    instance: getInstance(),
    containerWidth: args.containerWidth,
    containerHeight: args.containerHeight
  }),
  subscribe: (listener) => {
    const instance = getInstance()
    const { uiStore } = instance
    let selection = uiStore.get(selectionAtom)
    let contextMenu = uiStore.get(contextMenuStateAtom)
    let unsubscribeSelectionNodes = EMPTY_UNSUBSCRIBE
    let unsubscribeContextTarget = EMPTY_UNSUBSCRIBE

    const subscribeSelectionNodes = (nextSelection: Selection) => {
      const unsubscribeNodes = subscribeNodeIds(instance, nextSelection.nodeIds, listener)

      const nodeId = nextSelection.nodeIds[0]
      if (nextSelection.nodeIds.length !== 1 || !nodeId) {
        return unsubscribeNodes
      }

      return combineUnsubscribers([
        unsubscribeNodes,
        instance.draft.node.subscribe(nodeId, listener)
      ])
    }

    const subscribeContextTarget = (state: ContextMenuState) => {
      if (!state.open) {
        return EMPTY_UNSUBSCRIBE
      }

      switch (state.target.kind) {
        case 'node':
          return subscribeOptionalNode(instance, state.target.nodeId, listener)
        case 'nodes':
          return subscribeNodeIds(instance, state.target.nodeIds, listener)
        case 'edge':
          return instance.read.edge.subscribe(state.target.edgeId, listener)
        case 'canvas':
          return EMPTY_UNSUBSCRIBE
      }
    }

    unsubscribeSelectionNodes = subscribeSelectionNodes(selection)
    unsubscribeContextTarget = subscribeContextTarget(contextMenu)

    const handleSelectionChange = () => {
      unsubscribeSelectionNodes()
      selection = uiStore.get(selectionAtom)
      unsubscribeSelectionNodes = subscribeSelectionNodes(selection)
      listener()
    }

    const handleContextMenuChange = () => {
      unsubscribeContextTarget()
      contextMenu = uiStore.get(contextMenuStateAtom)
      unsubscribeContextTarget = subscribeContextTarget(contextMenu)
      listener()
    }

    const unsubscribeStatic = combineUnsubscribers([
      instance.viewport.subscribe(listener),
      uiStore.sub(selectionAtom, handleSelectionChange),
      uiStore.sub(nodeToolbarMenuStateAtom, listener),
      uiStore.sub(contextMenuStateAtom, handleContextMenuChange)
    ])
    return () => {
      unsubscribeSelectionNodes()
      unsubscribeContextTarget()
      unsubscribeStatic()
    }
  },
  isEqual: isSurfaceViewEqual
})
