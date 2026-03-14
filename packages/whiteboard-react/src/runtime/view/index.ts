import { activeContainerIdAtom } from '../state/container'
import { isScopeViewEqual, readScopeView } from './container'
import { contextMenuStateAtom } from '../../ui/chrome/context-menu/domain'
import { isInteractionViewEqual, readInteractionView } from './interaction'
import { isSelectionStateEqual, readSelectionState } from './selection'
import { selectionAtom } from '../state/selection'
import { nodeToolbarMenuStateAtom } from '../../ui/chrome/toolbar/domain'
import { toolAtom } from '../instance/toolState'
import type { InternalWhiteboardInstance } from '../instance/types'
import { createEdgeView } from './edge'
import { createNodeView } from './node'
import { createOverlayView } from './overlay'
import { createSurfaceView } from './surface'
import {
  combineUnsubscribers,
  EMPTY_UNSUBSCRIBE,
  subscribeNodeIds,
  subscribeOptionalNode
} from './shared'
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

    const subscribeSelectedNodes = () =>
      subscribeNodeIds(instance, selectedNodeIds, listener)

    const subscribeActiveContainer = () =>
      subscribeOptionalNode(instance, activeContainerId, listener)

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

    const unsubscribeStore = combineUnsubscribers([
      uiStore.sub(selectionAtom, handleSelectionChange),
      uiStore.sub(activeContainerIdAtom, handleScopeChange)
    ])
    return () => {
      unsubscribeSelectedNodes()
      unsubscribeActiveContainer()
      unsubscribeStore()
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

    const subscribeActiveContainer = () =>
      subscribeOptionalNode(instance, activeContainerId, listener)

    unsubscribeActiveContainer = subscribeActiveContainer()

    const unsubscribeScope = uiStore.sub(activeContainerIdAtom, () => {
      unsubscribeActiveContainer()
      activeContainerId = uiStore.get(activeContainerIdAtom)
      unsubscribeActiveContainer = subscribeActiveContainer()
      listener()
    })

    return combineUnsubscribers([
      unsubscribeActiveContainer,
      unsubscribeScope
    ])
  },
  isEqual: isScopeViewEqual
})

const createInteractionView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<ReturnType<typeof readInteractionView>> => ({
  get: () => readInteractionView(getInstance()),
  subscribe: (listener) => {
    const instance = getInstance()
    const { uiStore } = instance
    return combineUnsubscribers([
      uiStore.sub(toolAtom, listener),
      uiStore.sub(selectionAtom, listener),
      uiStore.sub(contextMenuStateAtom, listener),
      uiStore.sub(nodeToolbarMenuStateAtom, listener),
      instance.interaction.session.subscribe(listener)
    ])
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
  edge: createEdgeView(getInstance)
})
