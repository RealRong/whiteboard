import type { ReadContext } from '@engine-types/read/context'
import type { EdgeRead } from '@engine-types/read/edge'
import type {
  EdgeId
} from '@whiteboard/core/types'
import type { EdgePathEntry } from '@engine-types/instance/read'
import { cache } from './cache'

export const edge = (context: ReadContext): EdgeRead => {
  const memo = cache(context)
  let edgeViewCache: ReturnType<EdgeRead['get']['edge']> | undefined
  let edgeIdsRef: readonly EdgeId[] | undefined
  let edgeByIdRef: ReadonlyMap<EdgeId, EdgePathEntry> | undefined

  const applyPlan: EdgeRead['applyPlan'] = (plan) => {
    memo.applyPlan(plan)
  }

  return {
    get: {
      edge: () => {
        const snapshot = memo.getSnapshot()
        if (
          edgeViewCache &&
          edgeIdsRef === snapshot.ids &&
          edgeByIdRef === snapshot.byId
        ) {
          return edgeViewCache
        }
        edgeIdsRef = snapshot.ids
        edgeByIdRef = snapshot.byId
        edgeViewCache = {
          ids: snapshot.ids,
          byId: snapshot.byId,
          endpointsById: (edgeId) => memo.getSnapshot().getEndpoints(edgeId)
        }
        return edgeViewCache
      }
    },
    applyPlan
  }
}
