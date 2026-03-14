import {
  readContextMenuOpenResult,
  resolveContextMenuTarget
} from '../../../context-menu/view'
import { activeContainerIdAtom } from '../../../container/domain'
import { isScopeViewEqual, readScopeView } from '../../../container/view'
import { contextMenuStateAtom } from '../../../context-menu/domain'
import { isInteractionViewEqual, readInteractionView } from '../../../interaction/view'
import { interactionSessionStateAtom } from '../../../interaction/session'
import { isSelectionStateEqual, readSelectionState } from '../../../selection'
import { selectionAtom } from '../../../selection/domain'
import { nodeToolbarMenuStateAtom } from '../../../toolbar/domain'
import { toolAtom } from '../toolState'
import type { InternalWhiteboardInstance } from '../types'
import { createEdgeView } from './edge'
import { createNodeView } from './node'
import { createOverlayView } from './overlay'
import { createSurfaceView } from './surface'
import type { ValueView, WhiteboardView } from './types'

export type {
  KeyedView,
  ParameterizedView,
  OverlayView,
  SurfaceView,
  ValueView,
  WhiteboardView
} from './types'
export type { EdgeView } from './edge'
export type { NodeView } from './node'

const EMPTY_UNSUBSCRIBE = () => {}

const createSelectionView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<ReturnType<typeof readSelectionState>> => ({
  get: () => readSelectionState(getInstance()),
  subscribe: (listener) => {
    const instance = getInstance()
    const { uiStore } = instance
    let selectedNodeIds = uiStore.get(selectionAtom).nodeIds
    let activeContainerId = uiStore.get(activeContainerIdAtom)
    let unsubscribeSelectedNodes = EMPTY_UNSUBSCRIBE
    let unsubscribeActiveContainer = EMPTY_UNSUBSCRIBE

    const subscribeSelectedNodes = () => {
      if (!selectedNodeIds.length) {
        return EMPTY_UNSUBSCRIBE
      }
      const unsubscribers = selectedNodeIds.map((nodeId) =>
        instance.read.node.subscribe(nodeId, listener)
      )
      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe())
      }
    }

    const subscribeActiveContainer = () => {
      if (!activeContainerId) {
        return EMPTY_UNSUBSCRIBE
      }
      return instance.read.node.subscribe(activeContainerId, listener)
    }

    unsubscribeSelectedNodes = subscribeSelectedNodes()
    unsubscribeActiveContainer = subscribeActiveContainer()

    const handleSelectionChange = () => {
      unsubscribeSelectedNodes()
      selectedNodeIds = uiStore.get(selectionAtom).nodeIds
      unsubscribeSelectedNodes = subscribeSelectedNodes()
      listener()
    }

    const handleScopeChange = () => {
      unsubscribeActiveContainer()
      activeContainerId = uiStore.get(activeContainerIdAtom)
      unsubscribeActiveContainer = subscribeActiveContainer()
      listener()
    }

    const unsubscribers = [
      uiStore.sub(selectionAtom, handleSelectionChange),
      uiStore.sub(activeContainerIdAtom, handleScopeChange)
    ]

    return () => {
      unsubscribeSelectedNodes()
      unsubscribeActiveContainer()
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  },
  isEqual: isSelectionStateEqual
})

const createScopeView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<ReturnType<typeof readScopeView>> => ({
  get: () => readScopeView(getInstance()),
  subscribe: (listener) => {
    const instance = getInstance()
    const { uiStore } = instance
    let activeContainerId = uiStore.get(activeContainerIdAtom)
    let unsubscribeActiveContainer = EMPTY_UNSUBSCRIBE

    const subscribeActiveContainer = () => {
      if (!activeContainerId) {
        return EMPTY_UNSUBSCRIBE
      }
      return instance.read.node.subscribe(activeContainerId, listener)
    }

    unsubscribeActiveContainer = subscribeActiveContainer()

    const unsubscribeScope = uiStore.sub(activeContainerIdAtom, () => {
      unsubscribeActiveContainer()
      activeContainerId = uiStore.get(activeContainerIdAtom)
      unsubscribeActiveContainer = subscribeActiveContainer()
      listener()
    })

    return () => {
      unsubscribeActiveContainer()
      unsubscribeScope()
    }
  },
  isEqual: isScopeViewEqual
})

const createInteractionView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<ReturnType<typeof readInteractionView>> => ({
  get: () => readInteractionView(getInstance()),
  subscribe: (listener) => {
    const { uiStore } = getInstance()
    const unsubscribers = [
      uiStore.sub(toolAtom, listener),
      uiStore.sub(selectionAtom, listener),
      uiStore.sub(contextMenuStateAtom, listener),
      uiStore.sub(nodeToolbarMenuStateAtom, listener),
      uiStore.sub(interactionSessionStateAtom, listener)
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  },
  isEqual: isInteractionViewEqual
})

export const createWhiteboardView = (
  getInstance: () => InternalWhiteboardInstance
): WhiteboardView => ({
  selection: createSelectionView(getInstance),
  scope: createScopeView(getInstance),
  interaction: createInteractionView(getInstance),
  overlay: createOverlayView(getInstance),
  surface: createSurfaceView(getInstance),
  node: createNodeView(getInstance),
  edge: createEdgeView(getInstance),
  contextMenuTarget: (target) => resolveContextMenuTarget(getInstance(), target),
  contextMenuOpenResult: ({ targetElement, screen, world }) => readContextMenuOpenResult({
    instance: getInstance(),
    targetElement,
    screen,
    world
  })
})
