import {
  createDerivedStore,
  type KeyedReadStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId, NodeId, Node, Rect } from '@whiteboard/core/types'
import type { TargetBoundsInput } from '@whiteboard/core/node'
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
  nodeItem,
  edgeItem,
  bounds,
  nodeFrame,
  registry,
  resolveNodeTransform: readNodeTransform = resolveNodeTransform
}: {
  source: ReadStore<SelectionSource>
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  edgeItem: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  bounds: (input: TargetBoundsInput) => Rect | undefined
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
      readNode: (nodeId) => readStore(nodeItem, nodeId),
      readEdge: (edgeId) => readStore(edgeItem, edgeId),
      readBounds: bounds,
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
