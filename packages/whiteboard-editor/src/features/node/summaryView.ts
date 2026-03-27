import {
  readNodeSummaryDetail,
  readNodeSummaryTitle,
  type NodeSummary,
  type NodeTypeSummary
} from './summary'

const DEFAULT_PREVIEW_LIMIT = 3

export type NodeSummaryView = {
  types: readonly NodeTypeSummary[]
  overflow: number
  title: string
  detail?: string
  mixed: boolean
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
