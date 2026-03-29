import type {
  SelectionCan as NodeSelectionCan,
  SelectionNodeSummary as NodeSummary,
  SelectionNodeTypeSummary as NodeTypeSummary
} from '@whiteboard/editor/context'

export type {
  SelectionCan as NodeSelectionCan,
  SelectionNodeSummary as NodeSummary,
  SelectionNodeTypeSummary as NodeTypeSummary
} from '@whiteboard/editor/context'

export type NodeSummaryView = {
  types: readonly NodeTypeSummary[]
  overflow: number
  title: string
  detail?: string
  mixed: boolean
}

const DEFAULT_PREVIEW_LIMIT = 3

export const readNodeSummaryTitle = (
  summary: NodeSummary
) => (
  summary.count <= 1
    ? (summary.types[0]?.name ?? 'Item')
    : `${summary.count} items`
)

export const readNodeSummaryDetail = (
  summary: NodeSummary
) => {
  if (!summary.types.length) {
    return undefined
  }

  return summary.types
    .map((item) => item.count > 1 ? `${item.name} ×${item.count}` : item.name)
    .join(' · ')
}

export const readNodeSummaryView = (
  summary: NodeSummary,
  options?: {
    previewLimit?: number
  }
): NodeSummaryView | undefined => {
  const previewLimit = Math.max(1, options?.previewLimit ?? DEFAULT_PREVIEW_LIMIT)
  const types = summary.types.slice(0, previewLimit)

  if (!summary.count || !types.length) {
    return undefined
  }

  return {
    types,
    overflow: Math.max(0, summary.types.length - types.length),
    title: readNodeSummaryTitle(summary),
    detail: readNodeSummaryDetail(summary),
    mixed: summary.mixed
  }
}
