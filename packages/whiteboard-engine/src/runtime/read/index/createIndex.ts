import type { InstanceConfig } from '@engine-types/instance/config'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { MutationMeta } from '../../write/pipeline/MutationMetaBus'
import { hasImpactTag } from '../../write/mutation/Impact'
import {
  createQueryIndexes,
  type QueryIndexes
} from './QueryIndexes'

type CreateQueryIndexRuntimeOptions = {
  readSnapshot: () => ReadModelSnapshot
  config: InstanceConfig
}

export type QueryIndexRuntime = QueryIndexes & {
  applyMutation: (meta: MutationMeta) => void
}

export const createQueryIndexRuntime = ({
  readSnapshot,
  config
}: CreateQueryIndexRuntimeOptions): QueryIndexRuntime => {
  let snapshot = readSnapshot()

  const indexes = createQueryIndexes({
    config
  })
  indexes.sync(snapshot.nodes.canvas)

  const applyMutation: QueryIndexRuntime['applyMutation'] = (meta) => {
    snapshot = readSnapshot()
    const impact = meta.impact
    if (meta.kind === 'replace' || hasImpactTag(impact, 'full')) {
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
    applyMutation
  }
}
