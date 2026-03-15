import {
  isScopeViewEqual,
  resolveScopeView,
  type ScopeView
} from './scope'
import { isInteractionViewEqual, readInteractionView } from './interaction'
import {
  isSelectionStateEqual,
  resolveSelectionView,
  type SelectionState
} from './selection'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  WhiteboardCommands,
  WhiteboardRead
} from '../instance/types'
import type { EditorTool } from '../instance/toolState'
import { createEdgeView } from './edge'
import { createMindmapView } from './mindmap'
import { createNodeView } from './node'
import type { StoredSelection } from '../state/selection'
import type { Transient } from '../draft/runtime'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../interaction/types'
import {
  createDerivedStore,
  type ValueStore
} from '@whiteboard/core/runtime'
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

const EMPTY_NODE_IDS: readonly NodeId[] = []

const createNodeIdsView = (
  read: WhiteboardRead
): ValueView<readonly NodeId[]> => ({
  get: () => read.node.ids(),
  subscribe: (listener) => read.node.subscribeIds(listener)
})

const createEdgeIdsView = (
  read: WhiteboardRead
): ValueView<readonly EdgeId[]> => ({
  get: () => read.edge.ids(),
  subscribe: (listener) => read.edge.subscribeIds(listener)
})

const createMindmapIdsView = (
  read: WhiteboardRead
): ValueView<readonly NodeId[]> => ({
  get: () => read.mindmap.ids(),
  subscribe: (listener) => read.mindmap.subscribeIds(listener)
})

const createSelectionView = (
  selection: ValueStore<StoredSelection>,
  scope: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ValueView<SelectionState> => createDerivedStore({
  get: (readStore) => {
    const current = readStore(selection)
    const scopeId = readStore(scope)
    const activeScopeId = scopeId && readStore(read.node, scopeId)?.node
      ? scopeId
      : undefined

    return resolveSelectionView({
      selection: current,
      activeScopeId,
      readNode: (nodeId) => readStore(read.node, nodeId)
    })
  },
  isEqual: isSelectionStateEqual
})

const createScopeView = (
  scope: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ValueView<ScopeView> => {
  return createDerivedStore({
  get: (readStore) => {
    const scopeId = readStore(scope)
    const activeEntry = scopeId
      ? readStore(read.node, scopeId)
      : undefined
    const activeId = activeEntry?.node ? scopeId : undefined
    const nodeIds = activeId
      ? readStore(read.tree, activeId)
      : EMPTY_NODE_IDS
    const nodeIdSet = activeId
      ? new Set(nodeIds)
      : null
    const hasNode = (nodeId: NodeId) => (
      nodeIdSet ? nodeIdSet.has(nodeId) : true
    )
    const hasEdge = (value: EdgeId | Pick<Edge, 'source' | 'target'>) => {
      const edge = typeof value === 'string'
        ? read.edge.get(value)?.edge
        : value

      if (!edge) {
        return false
      }

      return hasNode(edge.source.nodeId) && hasNode(edge.target.nodeId)
    }

    return resolveScopeView({
      activeId,
      activeNode: activeEntry?.node,
      nodeIds,
      hasNode,
      hasEdge
    })
  },
  isEqual: isScopeViewEqual
  })
}

const createInteractionView = (
  interaction: InteractionCoordinator
): ValueView<ReturnType<typeof readInteractionView>> => createDerivedStore({
  get: (readStore) => readInteractionView({
    interaction: {
      session: {
        get: () => readStore(interaction.session)
      }
    }
  }),
  isEqual: isInteractionViewEqual
})

export const createWhiteboardView = (
  {
    tool,
    scope,
    selection,
    read,
    commands,
    draft,
    registry,
    interaction
  }: {
    tool: ValueStore<EditorTool>
    scope: ValueStore<NodeId | undefined>
    selection: ValueStore<StoredSelection>
    read: WhiteboardRead
    commands: WhiteboardCommands
    draft: Transient
    registry: NodeRegistry
    interaction: InteractionCoordinator
  }
): WhiteboardView => ({
  tool,
  nodeIds: createNodeIdsView(read),
  edgeIds: createEdgeIdsView(read),
  mindmapIds: createMindmapIdsView(read),
  selection: createSelectionView(selection, scope, read),
  scope: createScopeView(scope, read),
  interaction: createInteractionView(interaction),
  node: createNodeView({
    read,
    commands,
    draft,
    registry
  }),
  edge: createEdgeView({
    read,
    draft
  }),
  mindmap: createMindmapView(read)
})
