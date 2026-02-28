import type { InstanceConfig } from '@engine-types/instance/config'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { Change } from '../../write/pipeline/ChangeBus'
import { hasImpactTag } from '../../write/mutation/Impact'
import {
  store,
  type IndexStore
} from './store'

type IndexOptions = {
  readSnapshot: () => ReadModelSnapshot
  config: InstanceConfig
}

export type IndexRuntime = IndexStore & {
  applyChange: (change: Change) => void
}

export const runtime = ({
  readSnapshot,
  config
}: IndexOptions): IndexRuntime => {
  let snapshot = readSnapshot()

  const indexes = store({
    config
  })
  indexes.sync(snapshot.nodes.canvas)

  const applyChange: IndexRuntime['applyChange'] = (change) => {
    snapshot = readSnapshot()
    const impact = change.impact
    if (change.kind === 'replace' || hasImpactTag(impact, 'full')) {
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
    applyChange
  }
}
