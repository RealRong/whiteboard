import type { EngineRead, ReadPublicKey } from '@engine-types/instance/read'
import type { Orchestrator as ReadOrchestrator } from '@engine-types/read/orchestrator'
import type { Deps as ReadDeps } from '@engine-types/read/deps'
import { toReadChangePlan } from './changePlan'
import { context } from './context'
import { edge } from './edge/runtime'
import { node } from './node/runtime'
import { mindmap } from './mindmap/runtime'
import { indexer } from './index/runtime'
import { query } from './query'

export const orchestrator = ({
  runtimeStore,
  stateAtoms,
  snapshotAtom,
  config,
  readDoc,
  viewport
}: ReadDeps): ReadOrchestrator => {
  const snapshot = () => runtimeStore.get(snapshotAtom)
  const indexes = indexer(config, snapshot)
  const api = query({
    readDoc,
    viewport,
    config,
    indexes
  })

  const ctx = context({
    runtimeStore,
    stateAtoms,
    snapshotAtom,
    config,
    query: api
  })
  const edges = edge(ctx)
  const nodes = node(ctx)
  const maps = mindmap(ctx)

  const get: EngineRead['get'] = Object.assign(
    <K extends ReadPublicKey>(key: K) => ctx.get(key),
    nodes.get,
    edges.get,
    maps.get
  )

  return {
    query: api,
    read: {
      get,
      subscribe: ctx.subscribe
    },
    applyChange: (change) => {
      const plan = toReadChangePlan(change)
      indexes.applyPlan(plan.index)
      edges.applyChange(plan)
    }
  }
}
