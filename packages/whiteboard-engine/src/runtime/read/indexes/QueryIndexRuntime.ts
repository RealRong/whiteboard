import type { InstanceConfig } from '@engine-types/instance/config'
import type { ProjectionCommit, ProjectionStore } from '@engine-types/projection'
import { hasImpactTag } from '../../mutation/Impact'
import {
  createQueryIndexes,
  type QueryIndexes
} from './QueryIndexes'

type CreateQueryIndexRuntimeOptions = {
  projection: ProjectionStore
  config: InstanceConfig
}

export type QueryIndexRuntime = QueryIndexes & {
  applyCommit: (commit: ProjectionCommit) => void
}

export const createQueryIndexRuntime = ({
  projection,
  config
}: CreateQueryIndexRuntimeOptions): QueryIndexRuntime => {
  let snapshot = projection.getSnapshot()

  const indexes = createQueryIndexes({
    config
  })
  indexes.sync(snapshot.nodes.canvas)

  const applyCommit: QueryIndexRuntime['applyCommit'] = (commit) => {
    snapshot = commit.snapshot
    const impact = commit.impact
    if (commit.kind === 'replace' || hasImpactTag(impact, 'full')) {
      indexes.sync(snapshot.nodes.canvas)
      return
    }
    if (hasImpactTag(impact, 'order') && !hasImpactTag(impact, 'edges')) {
      indexes.sync(snapshot.nodes.canvas)
      return
    }
    if (impact.dirtyNodeIds?.length) {
      indexes.syncByNodeIds(impact.dirtyNodeIds, snapshot.indexes.canvasNodeById)
      return
    }
    if (hasImpactTag(impact, 'geometry') || hasImpactTag(impact, 'mindmap')) {
      indexes.sync(snapshot.nodes.canvas)
    }
  }

  return {
    ...indexes,
    applyCommit
  }
}
