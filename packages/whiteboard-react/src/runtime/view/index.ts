import {
  isContainerViewEqual,
  resolveContainerView,
  type ContainerView
} from './container'
import {
  isSelectionStateEqual,
  resolveSelectionView,
  type SelectionState
} from './selection'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  EditorTool,
  WhiteboardRead
} from '../instance/types'
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
export type { EditorTool as ToolView } from '../instance/types'

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
  container: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ValueView<SelectionState> => createDerivedStore({
  get: (readStore) => {
    const current = readStore(selection)
    const containerId = readStore(container)
    const activeContainerId =
      containerId && readStore(read.node.byId, containerId)?.node
        ? containerId
      : undefined

    return resolveSelectionView({
      selection: current,
      activeContainerId,
      readNode: (nodeId) => readStore(read.node.byId, nodeId)
    })
  },
  isEqual: isSelectionStateEqual
})

const createContainerView = (
  container: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ValueView<ContainerView> => {
  return createDerivedStore({
    get: (readStore) => {
      const containerId = readStore(container)
      const activeEntry = containerId
        ? readStore(read.node.byId, containerId)
        : undefined
      const activeId = activeEntry?.node ? containerId : undefined
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

      return resolveContainerView({
        activeId,
        activeNode: activeEntry?.node,
        nodeIds,
        hasNode,
        hasEdge
      })
    },
    isEqual: isContainerViewEqual
  })
}

export const createWhiteboardView = (
  {
    tool,
    container,
    selection,
    read
  }: {
    tool: ValueStore<EditorTool>
    container: ValueStore<NodeId | undefined>
    selection: ValueStore<StoredSelection>
    read: WhiteboardRead
  }
): WhiteboardView => ({
  tool,
  nodeIds: createNodeIdsView(read),
  edgeIds: createEdgeIdsView(read),
  mindmapIds: createMindmapIdsView(read),
  selection: createSelectionView(selection, container, read),
  container: createContainerView(container, read)
})
