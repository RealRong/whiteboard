import { useMemo } from 'react'
import type { View as SelectionView } from '../../runtime/selection'
import type { Node } from '@whiteboard/core/types'
import type { NodeMeta } from '../../types/node'
import { resolveNodeMeta } from './registry'
import {
  resolveNodeSelectionCan,
  summarizeNodes,
  type NodeSelectionCan,
  type NodeSummary
} from './summary'
import { useInternalInstance } from '../../runtime/hooks/useWhiteboard'
import { useStoreValue } from '../../runtime/hooks/useStoreValue'

export type NodeSelectionView = SelectionView & {
  summary: NodeSummary
  can: NodeSelectionCan
}

const EMPTY_SUMMARY = summarizeNodes([])
const EMPTY_CAN = resolveNodeSelectionCan([])

export const resolveNodeSelectionView = (
  selection: SelectionView,
  options?: {
    resolveMeta?: (node: Node) => NodeMeta | undefined
  }
): NodeSelectionView => {
  const nodes = selection.items.nodes

  return {
    ...selection,
    summary: nodes.length > 0
      ? summarizeNodes(nodes, {
          resolveMeta: options?.resolveMeta
        })
      : EMPTY_SUMMARY,
    can: nodes.length > 0
      ? resolveNodeSelectionCan(nodes, {
          resolveMeta: options?.resolveMeta
        })
      : EMPTY_CAN
  }
}

export const useSelection = (): NodeSelectionView => {
  const instance = useInternalInstance()
  const selection = useStoreValue(instance.read.selection)

  return useMemo(() => resolveNodeSelectionView(selection, {
    resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
  }), [instance, selection])
}
