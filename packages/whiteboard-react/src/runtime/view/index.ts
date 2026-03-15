import { activeContainerIdAtom } from '../state/container'
import { isScopeViewEqual, readScopeView } from './container'
import { isInteractionViewEqual, readInteractionView } from './interaction'
import { isSelectionStateEqual, readSelectionState } from './selection'
import { selectionAtom } from '../state/selection'
import { toolAtom } from '../instance/toolState'
import type { InternalWhiteboardInstance } from '../instance/types'
import { createEdgeView } from './edge'
import { createNodeView } from './node'
import { readToolView } from './tool'
import {
  combineUnsubscribers,
  EMPTY_UNSUBSCRIBE,
  subscribeNodeIds,
  subscribeOptionalNode
} from './shared'
import type { ValueView, WhiteboardView } from './types'

export type {
  KeyedView,
  ValueView,
  WhiteboardView
} from './types'
export type { EdgeView } from './edge'
export type { NodeView } from './node'
export type { EditorTool as ToolView } from '../instance/toolState'

const createToolView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<ReturnType<typeof readToolView>> => ({
  get: () => readToolView(getInstance()),
  subscribe: (listener) => getInstance().uiStore.sub(toolAtom, listener)
})

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
    return instance.interaction.session.subscribe(listener)
  },
  isEqual: isInteractionViewEqual
})

export const createWhiteboardView = (
  getInstance: () => InternalWhiteboardInstance
): WhiteboardView => ({
  tool: createToolView(getInstance),
  selection: createSelectionView(getInstance),
  scope: createScopeView(getInstance),
  interaction: createInteractionView(getInstance),
  node: createNodeView(getInstance),
  edge: createEdgeView(getInstance)
})
