import type { EdgePathEntry } from '@engine-types/instance/read'
import type { ReadContext } from '@engine-types/read/context'
import type { EdgeRead } from '@engine-types/read/edge'
import type { EdgeId } from '@whiteboard/core/types'
import { cache } from './cache'

export const edge = (context: ReadContext): EdgeRead => {
  const edgeCache = cache(context)
  let edgeViewCache: ReturnType<EdgeRead['get']['edge']> | undefined
  let edgeIdsRef: readonly EdgeId[] | undefined
  let edgeByIdRef: ReadonlyMap<EdgeId, EdgePathEntry> | undefined

  const applyChange: EdgeRead['applyChange'] = (change) => {
    edgeCache.applyChange(change)
  }

  return {
    get: {
      edge: () => {
        const snapshot = edgeCache.getSnapshot()
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
          endpointsById: (edgeId) => edgeCache.getSnapshot().getEndpoints(edgeId)
        }
        return edgeViewCache
      }
    },
    applyChange
  }
}
