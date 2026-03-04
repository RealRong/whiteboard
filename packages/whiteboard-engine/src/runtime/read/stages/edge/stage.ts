import type { ReadRuntimeContext } from '@engine-types/read/context'
import type { EdgeReadRuntime } from '@engine-types/read/edge'
import type {
  EdgeId
} from '@whiteboard/core/types'
import type { EdgePathEntry } from '@engine-types/instance/read'
import { cache } from './cache'

export const edge = (context: ReadRuntimeContext): EdgeReadRuntime => {
  const memo = cache(context)
  let edgeViewCache: ReturnType<EdgeReadRuntime['get']['edge']> | undefined
  let edgeIdsRef: readonly EdgeId[] | undefined
  let edgeByIdRef: ReadonlyMap<EdgeId, EdgePathEntry> | undefined

  const applyPlan: EdgeReadRuntime['applyPlan'] = (plan) => {
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
          byId: snapshot.byId
        }
        return edgeViewCache
      }
    },
    applyPlan
  }
}
