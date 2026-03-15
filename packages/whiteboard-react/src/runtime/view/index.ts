import {
  isScopeViewEqual,
  resolveScopeView,
  type ScopeView
} from './scope'
import {
  isSelectionStateEqual,
  resolveSelectionView,
  type SelectionState
} from './selection'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  WhiteboardRead
} from '../instance/types'
import type { EditorTool } from '../instance/toolState'
import type { StoredSelection } from '../state/selection'
import {
  createDerivedStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import type { ValueView, WhiteboardView } from './types'

export type {
  ValueView,
  WhiteboardView
} from './types'
export type { EditorTool as ToolView } from '../instance/toolState'

const EMPTY_NODE_IDS: readonly NodeId[] = []

const createNodeIdsView = (
  read: WhiteboardRead
): ValueView<readonly NodeId[]> => read.node.ids

const createEdgeIdsView = (
  read: WhiteboardRead
): ValueView<readonly EdgeId[]> => read.edge.ids

const createMindmapIdsView = (
  read: WhiteboardRead
): ValueView<readonly NodeId[]> => read.mindmap.ids

const createSelectionView = (
  selection: ValueStore<StoredSelection>,
  scope: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ValueView<SelectionState> => createDerivedStore({
  get: (readStore) => {
    const current = readStore(selection)
    const scopeId = readStore(scope)
    const activeScopeId = scopeId && readStore(read.node.byId, scopeId)?.node
      ? scopeId
      : undefined

    return resolveSelectionView({
      selection: current,
      activeScopeId,
      readNode: (nodeId) => readStore(read.node.byId, nodeId)
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
        ? readStore(read.node.byId, scopeId)
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
          ? read.edge.byId.get(value)?.edge
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

export const createWhiteboardView = (
  {
    tool,
    scope,
    selection,
    read
  }: {
    tool: ValueStore<EditorTool>
    scope: ValueStore<NodeId | undefined>
    selection: ValueStore<StoredSelection>
    read: WhiteboardRead
  }
): WhiteboardView => ({
  tool,
  nodeIds: createNodeIdsView(read),
  edgeIds: createEdgeIdsView(read),
  mindmapIds: createMindmapIdsView(read),
  selection: createSelectionView(selection, scope, read),
  scope: createScopeView(scope, read)
})
