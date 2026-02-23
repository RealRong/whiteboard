import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type MutationImpactTag =
  | 'full'
  | 'nodes'
  | 'edges'
  | 'order'
  | 'geometry'
  | 'mindmap'
  | 'viewport'

export type MutationImpact = {
  tags: ReadonlySet<MutationImpactTag>
  dirtyNodeIds?: readonly NodeId[]
  dirtyEdgeIds?: readonly EdgeId[]
}

const PROJECTION_TAGS: readonly MutationImpactTag[] = [
  'full',
  'nodes',
  'edges',
  'order',
  'geometry',
  'mindmap'
]
const FULL_IMPACT_TAGS = new Set<MutationImpactTag>(['full'])

export const FULL_MUTATION_IMPACT: MutationImpact = {
  tags: FULL_IMPACT_TAGS
}

export const hasImpactTag = (
  impact: MutationImpact,
  tag: MutationImpactTag
) => impact.tags.has(tag)

export const affectsProjection = (impact: MutationImpact) =>
  PROJECTION_TAGS.some((tag) => hasImpactTag(impact, tag))
