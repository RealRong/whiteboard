import {
  READ_INTERNAL_SIGNAL_KEYS,
  type ReadRuntimeContext
} from '../context'
import type { EngineReadGetters } from '@engine-types/instance/read'
import type { ReadChangePlan } from '../changePlan'
import { cache as createEdgeCache } from './cache'
import { atoms as createEdgeAtoms } from './atoms'

type EdgeReadGet = Pick<
  EngineReadGetters,
  'edgeIds' | 'edgeById' | 'selectedEdgeId' | 'edgeSelectedEndpoints'
>

export type EdgeReadRuntime = {
  get: EdgeReadGet
  applyChange: (plan: ReadChangePlan) => void
}

export const runtime = (context: ReadRuntimeContext): EdgeReadRuntime => {
  const cache = createEdgeCache(context)
  const derivedAtoms = createEdgeAtoms(context, cache)

  const applyChange: EdgeReadRuntime['applyChange'] = (plan) => {
    cache.applyPlan(plan.edge)

    if (plan.edge.bumpRevision) {
      context.setSignal(
        READ_INTERNAL_SIGNAL_KEYS.edgeRevision,
        (previous: number) => previous + 1
      )
    }
  }

  return {
    get: {
      edgeIds: () => context.store.get(derivedAtoms.edgeIds),
      edgeById: (id) => context.store.get(derivedAtoms.edgeById(id)),
      selectedEdgeId: () => context.store.get(derivedAtoms.selectedEdgeId),
      edgeSelectedEndpoints: () =>
        context.store.get(derivedAtoms.edgeSelectedEndpoints)
    },
    applyChange
  }
}
