import type { ProjectionChange, ProjectionStore } from '@engine-types/projection'
import type { MutationImpact } from '../mutation/Impact'
import { affectsProjection, hasImpactTag } from '../mutation/Impact'

type QueryRuntime = {
  apply: (change: ProjectionChange | undefined) => void
}

type ViewRuntime = {
  apply: (change: ProjectionChange | undefined) => void
}

type Options = {
  projection: ProjectionStore
  query: QueryRuntime
  view: ViewRuntime
}

export class SyncCoordinator {
  constructor(private readonly options: Options) {}

  sync = (impact: MutationImpact) => {
    if (!affectsProjection(impact)) return
    const full = hasImpactTag(impact, 'full')
    const orderChanged = hasImpactTag(impact, 'order') ? true : undefined
    const change = this.options.projection.sync({
      source: 'doc',
      full,
      dirtyNodeIds: impact.dirtyNodeIds,
      orderChanged
    })
    this.options.query.apply(change)
    this.options.view.apply(change)
  }
}
