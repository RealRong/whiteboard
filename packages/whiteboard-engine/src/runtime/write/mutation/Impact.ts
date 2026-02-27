import type {
  ProjectionImpact,
  ProjectionImpactTag
} from '@engine-types/projection'

export type MutationImpact = ProjectionImpact
export type MutationImpactTag = ProjectionImpactTag

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
