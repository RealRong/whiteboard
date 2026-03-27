import type { Node } from '@whiteboard/core/types'
import {
  createNodeSelectionActions as createNodeSelectionActionsBase,
  type NodeSelectionCan,
  type NodeSelectionActions,
  type NodeSummary
} from '@whiteboard/editor'
import type { InternalInstance } from '../../runtime/instance'
import { resolveNodeMeta } from './registry'

type NodeActionsInstance = Pick<InternalInstance, 'commands' | 'registry'>

type NodeActionExtras = {
  onCopy?: () => unknown
  onCut?: () => unknown
  summary?: NodeSummary
  can?: NodeSelectionCan
}

export type {
  NodeActionItem,
  NodeActionSection,
  NodeSelectionActions
} from '@whiteboard/editor'

export const createNodeSelectionActions = (
  instance: NodeActionsInstance,
  nodes: readonly Node[],
  extras?: NodeActionExtras
): NodeSelectionActions => createNodeSelectionActionsBase(
  instance,
  nodes,
  {
    ...extras,
    resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
  }
)
