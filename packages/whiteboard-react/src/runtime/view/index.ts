import { activeContainerIdAtom } from '../state/container'
import { isScopeViewEqual, readScopeView } from './scope'
import { isInteractionViewEqual, readInteractionView } from './interaction'
import { isSelectionStateEqual, readSelectionState } from './selection'
import { selectionAtom } from '../state/selection'
import { toolAtom, type EditorTool } from '../instance/toolState'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../instance/types'
import { createEdgeView } from './edge'
import { createMindmapView } from './mindmap'
import { createNodeView } from './node'
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
export type { MindmapViewTree as MindmapView } from '@whiteboard/engine'
export type { NodeView } from './node'
export type { EditorTool as ToolView } from '../instance/toolState'

const createToolView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<EditorTool> => ({
  get: () => getInstance().uiStore.get(toolAtom),
  subscribe: (listener) => getInstance().uiStore.sub(toolAtom, listener)
})

const createNodeIdsView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<readonly NodeId[]> => ({
  get: () => getInstance().read.node.ids(),
  subscribe: (listener) => getInstance().read.node.subscribeIds(listener)
})

const createEdgeIdsView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<readonly EdgeId[]> => ({
  get: () => getInstance().read.edge.ids(),
  subscribe: (listener) => getInstance().read.edge.subscribeIds(listener)
})

const createMindmapIdsView = (
  getInstance: () => InternalWhiteboardInstance
): ValueView<readonly NodeId[]> => ({
  get: () => getInstance().read.mindmap.ids(),
  subscribe: (listener) => getInstance().read.mindmap.subscribeIds(listener)
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
    let unsubscribeTree = EMPTY_UNSUBSCRIBE

    const subscribeActiveContainer = () =>
      subscribeOptionalNode(instance, activeContainerId, listener)

    const subscribeTree = () => (
      activeContainerId
        ? instance.read.tree.subscribe(activeContainerId, listener)
        : EMPTY_UNSUBSCRIBE
    )

    unsubscribeActiveContainer = subscribeActiveContainer()
    unsubscribeTree = subscribeTree()

    const unsubscribeScope = uiStore.sub(activeContainerIdAtom, () => {
      unsubscribeActiveContainer()
      unsubscribeTree()
      activeContainerId = uiStore.get(activeContainerIdAtom)
      unsubscribeActiveContainer = subscribeActiveContainer()
      unsubscribeTree = subscribeTree()
      listener()
    })

    return combineUnsubscribers([
      unsubscribeTree,
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
  nodeIds: createNodeIdsView(getInstance),
  edgeIds: createEdgeIdsView(getInstance),
  mindmapIds: createMindmapIdsView(getInstance),
  selection: createSelectionView(getInstance),
  scope: createScopeView(getInstance),
  interaction: createInteractionView(getInstance),
  node: createNodeView(getInstance),
  edge: createEdgeView(getInstance),
  mindmap: createMindmapView(getInstance)
})
