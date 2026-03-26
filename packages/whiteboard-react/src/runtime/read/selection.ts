import {
  createDerivedStore,
  type KeyedReadStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId, NodeId, Node, Rect } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import {
  resolveNodeRole,
  resolveNodeTransform
} from './node'
import {
  isViewEqual,
  resolveView,
  type Source as SelectionSource,
  type View as SelectionView
} from '../selection/state'
import {
  createSelectionPressPolicy,
  type SelectionPressContext,
  type SelectionPressPlan
} from '../selection/policy'

export type SelectionRead = ReadStore<SelectionView> & {
  press: (ctx: SelectionPressContext) => SelectionPressPlan | undefined
}

export const createSelectionRead = ({
  source,
  nodeList,
  nodeItem,
  edgeItem,
  edgeBounds,
  nodeBounds,
  nodeFrame,
  registry,
  resolveNodeTransform: readNodeTransform = resolveNodeTransform
}: {
  source: ReadStore<SelectionSource>
  nodeList: ReadStore<readonly NodeId[]>
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  edgeItem: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  edgeBounds: (edgeId: EdgeId) => Rect | undefined
  nodeBounds: (nodeId: NodeId) => Rect | undefined
  nodeFrame: (nodeId: NodeId) => Rect | undefined
  registry: NodeRegistry
  resolveNodeTransform?: typeof resolveNodeTransform
}): SelectionRead => {
  const getNodeRole = (node: Node) => resolveNodeRole(
    registry.get(node.type)
  )
  const store = createDerivedStore<SelectionView>({
    get: (readStore) => resolveView({
      source: readStore(source),
      allNodeIds: readStore(nodeList),
      readNode: (nodeId) => readStore(nodeItem, nodeId),
      readEdge: (edgeId) => readStore(edgeItem, edgeId),
      readEdgeBounds: edgeBounds,
      readNodeBounds: nodeBounds,
      resolveNodeRole: getNodeRole,
      resolveNodeTransform: (node) => readNodeTransform(
        registry.get(node.type)
      )
    }),
    isEqual: isViewEqual
  })
  const policy = createSelectionPressPolicy({
    getSelection: store.get,
    getNode: (nodeId) => nodeItem.get(nodeId)?.node,
    getNodeFrame: nodeFrame,
    getNodeRole
  })

  return Object.assign(store, {
    press: policy.press
  })
}
