import { READ_PUBLIC_KEYS } from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '@engine-types/read/context'
import type { EdgeReadRuntime } from '@engine-types/read/edge'
import { cache } from './cache'

export const edge = (context: ReadRuntimeContext): EdgeReadRuntime => {
  const memo = cache(context)

  const applyChange: EdgeReadRuntime['applyChange'] = (plan) => {
    memo.applyPlan(plan.edge)
  }

  return {
    get: {
      edgeIds: () => memo.getSnapshot().ids,
      edgeById: (id) => memo.getSnapshot().byId.get(id),
      selectedEdgeId: () => context.get(READ_PUBLIC_KEYS.selection).selectedEdgeId,
      edgeSelectedEndpoints: () => {
        const selectedEdgeId = context.get(READ_PUBLIC_KEYS.selection).selectedEdgeId
        if (!selectedEdgeId) return undefined
        return memo.getSnapshot().getEndpoints(selectedEdgeId)
      }
    },
    applyChange
  }
}
