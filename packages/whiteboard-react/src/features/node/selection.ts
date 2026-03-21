import type { View as SelectionView } from '../../runtime/selection'
import type { NodeMeta } from '../../types/node'
import {
  resolveNodeSelectionCan,
  summarizeNodes,
  type NodeSelectionCan,
  type NodeSummary
} from './summary'

export type NodeSelectionView = SelectionView & {
  summary: NodeSummary
  can: NodeSelectionCan
}

const EMPTY_SUMMARY = summarizeNodes([])
const EMPTY_CAN = resolveNodeSelectionCan([])

export const resolveNodeSelectionView = (
  selection: SelectionView,
  options?: {
    resolveMeta?: (type: string) => NodeMeta | undefined
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
