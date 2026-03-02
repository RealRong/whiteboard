import {
  READ_INTERNAL_SIGNAL_KEYS,
  type ReadRuntimeContext
} from '../context'
import type { ReadDomain } from '../domainTypes'
import { cache as createEdgeCache } from './cache'
import { atoms as createEdgeAtoms } from './atoms'

type EdgeReadAtomKey =
  | 'edgeIds'
  | 'edgeById'
  | 'selectedEdgeId'
  | 'edgeSelectedEndpoints'

type EdgeReadGetterKey = EdgeReadAtomKey

export type EdgeReadDomain = ReadDomain<
  EdgeReadAtomKey,
  EdgeReadGetterKey
>

export const domain = (context: ReadRuntimeContext): EdgeReadDomain => {
  const cache = createEdgeCache(context)
  const derivedAtoms = createEdgeAtoms(context, cache)

  const applyChange: EdgeReadDomain['applyChange'] = (plan) => {
    cache.applyPlan(plan.edge)

    if (plan.edge.bumpRevision) {
      context.setSignal(
        READ_INTERNAL_SIGNAL_KEYS.edgeRevision,
        (previous: number) => previous + 1
      )
    }
  }

  return {
    atoms: derivedAtoms,
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
