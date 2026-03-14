import type { NodeId } from '@whiteboard/core/types'
import { contextMenuStateAtom, type ContextMenuState } from '../../../ui/chrome/context-menu/domain'
import { readContextMenuView } from '../../../ui/chrome/context-menu/view'
import type { ContextMenuSection, ContextMenuView } from '../../../ui/chrome/context-menu/types'
import { selectionAtom, type Selection } from '../../state/selection'
import type { NodeToolbarItem } from '../../../ui/chrome/toolbar/model'
import { readNodeToolbarView } from '../../../ui/chrome/toolbar/view'
import type { NodeToolbarView } from '../../../ui/chrome/toolbar/view'
import { nodeToolbarMenuStateAtom } from '../../../ui/chrome/toolbar/domain'
import type { InternalWhiteboardInstance } from '../types'
import type {
  ParameterizedView,
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
          value: toolbar,
          menuKey: toolbarMenu.open ? toolbarMenu.key : undefined
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

const isSameNodeIds = (
  left: readonly NodeId[],
  right: readonly NodeId[]
) => (
  left === right
  || (
    left.length === right.length
    && left.every((nodeId, index) => nodeId === right[index])
  )
)

const isSameNodes = (
  left: NodeToolbarView['nodes'],
  right: NodeToolbarView['nodes']
) => (
  left === right
  || (
    left.length === right.length
    && left.every((node, index) => node === right[index])
  )
)

const isSameToolbarItems = (
  left: readonly NodeToolbarItem[],
  right: readonly NodeToolbarItem[]
) => (
  left === right
  || (
    left.length === right.length
    && left.every((item, index) => (
      item.key === right[index]?.key
      && item.label === right[index]?.label
      && item.active === right[index]?.active
      && item.menuKey === right[index]?.menuKey
      && item.run === right[index]?.run
      && item.icon === right[index]?.icon
    ))
  )
)

const isSameToolbarView = (
  left: NodeToolbarView | undefined,
  right: NodeToolbarView | undefined
) => {
  if (left === right) return true
  if (!left || !right) return false

  return (
    left.mode === right.mode
    && left.primaryNode === right.primaryNode
    && left.primarySchema === right.primarySchema
    && left.placement === right.placement
    && left.anchor.x === right.anchor.x
    && left.anchor.y === right.anchor.y
    && isSameNodeIds(left.nodeIds, right.nodeIds)
    && isSameNodes(left.nodes, right.nodes)
    && isSameToolbarItems(left.items, right.items)
  )
}

const isSameContextMenuItems = (
  left: ContextMenuSection['items'],
  right: ContextMenuSection['items']
) => (
  left === right
  || (
    left.length === right.length
    && left.every((item, index) => (
      item.key === right[index]?.key
      && item.label === right[index]?.label
      && item.disabled === right[index]?.disabled
      && item.tone === right[index]?.tone
      && item.run === right[index]?.run
    ))
  )
)

const isSameContextMenuSections = (
  left: readonly ContextMenuSection[],
  right: readonly ContextMenuSection[]
) => (
  left === right
  || (
    left.length === right.length
    && left.every((section, index) => (
      section.key === right[index]?.key
      && section.title === right[index]?.title
      && isSameContextMenuItems(section.items, right[index]?.items ?? [])
    ))
  )
)

const isSameContextMenuView = (
  left: ContextMenuView | undefined,
  right: ContextMenuView | undefined
) => {
  if (left === right) return true
  if (!left || !right) return false

  return (
    left.placement.left === right.placement.left
    && left.placement.top === right.placement.top
    && left.placement.transform === right.placement.transform
    && isSameContextMenuSections(left.sections, right.sections)
  )
}

export const isSurfaceViewEqual = (
  left: SurfaceView,
  right: SurfaceView
) => (
  left.toolbar?.menuKey === right.toolbar?.menuKey
  && isSameToolbarView(left.toolbar?.value, right.toolbar?.value)
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
    let unsubscribeSelectionNodes = () => {}
    let unsubscribeContextTarget = () => {}

    const subscribeSelectionNodes = (nextSelection: Selection) => {
      const unsubscribers = nextSelection.nodeIds.map((nodeId) =>
        instance.read.node.subscribe(nodeId, listener)
      )

      if (nextSelection.nodeIds.length === 1) {
        unsubscribers.push(
          instance.draft.node.subscribe(nextSelection.nodeIds[0], listener)
        )
      }

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    }

    const subscribeContextTarget = (state: ContextMenuState) => {
      if (!state.open) {
        return () => {}
      }

      switch (state.target.kind) {
        case 'node':
          return instance.read.node.subscribe(state.target.nodeId, listener)
        case 'nodes': {
          const unsubscribers = state.target.nodeIds.map((nodeId) =>
            instance.read.node.subscribe(nodeId, listener)
          )
          return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe())
          }
        }
        case 'edge':
          return instance.read.edge.subscribe(state.target.edgeId, listener)
        case 'canvas':
          return () => {}
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

    const unsubscribers = [
      instance.viewport.subscribe(listener),
      uiStore.sub(selectionAtom, handleSelectionChange),
      uiStore.sub(nodeToolbarMenuStateAtom, listener),
      uiStore.sub(contextMenuStateAtom, handleContextMenuChange)
    ]

    return () => {
      unsubscribeSelectionNodes()
      unsubscribeContextTarget()
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  },
  isEqual: isSurfaceViewEqual
})
