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
  type ReadStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import type { WhiteboardView } from './types'

export type { WhiteboardView } from './types'
export type { EditorTool as ToolView } from '../instance/types'

const EMPTY_NODE_IDS: readonly NodeId[] = []

const createNodeIdsView = (
  read: WhiteboardRead
): ReadStore<readonly NodeId[]> => read.node.list

const createEdgeIdsView = (
  read: WhiteboardRead
): ReadStore<readonly EdgeId[]> => read.edge.list

const createMindmapIdsView = (
  read: WhiteboardRead
): ReadStore<readonly NodeId[]> => read.mindmap.list

const createSelectionView = (
  selection: ValueStore<StoredSelection>,
  container: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ReadStore<SelectionState> => createDerivedStore({
  get: (readStore) => {
    const current = readStore(selection)
    const containerId = readStore(container)
    const activeContainerId =
      containerId && readStore(read.node.item, containerId)?.node
        ? containerId
        : undefined

    return resolveSelectionView({
      selection: current,
      activeContainerId,
      readNode: (nodeId) => readStore(read.node.item, nodeId)
    })
  },
  isEqual: isSelectionStateEqual
})

const createContainerView = (
  container: ValueStore<NodeId | undefined>,
  read: WhiteboardRead
): ReadStore<ContainerView> => {
  return createDerivedStore({
    get: (readStore) => {
      const containerId = readStore(container)
      const activeEntry = containerId
        ? readStore(read.node.item, containerId)
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
          ? read.edge.item.get(value)?.edge
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
