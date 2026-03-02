import type {
  MutationImpact,
  MutationImpactTag
} from '@engine-types/write/mutation'

const FULL_IMPACT_TAGS = new Set<MutationImpactTag>(['full'])

export const FULL_MUTATION_IMPACT: MutationImpact = {
  tags: FULL_IMPACT_TAGS
}

export const hasImpactTag = (
  impact: MutationImpact,
  tag: MutationImpactTag
) => impact.tags.has(tag)
