import { isPointEqual } from '@whiteboard/core/geometry'
import type { Point } from '@whiteboard/core/types'
import {
  createRafValueStore,
  type StagedValueStore
} from '@whiteboard/engine'

export type EdgeGuide = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

export type EdgeGuideRuntime =
  Pick<StagedValueStore<EdgeGuide>, 'get' | 'subscribe'> & {
    set: (next?: EdgeGuide) => void
    clear: () => void
  }

const EMPTY_EDGE_GUIDE: EdgeGuide = {}

const isEdgeGuideEqual = (
  left: EdgeGuide,
  right: EdgeGuide
) => (
  isPointEqual(left.line?.from, right.line?.from)
  && isPointEqual(left.line?.to, right.line?.to)
  && isPointEqual(left.snap, right.snap)
)

export const createEdgeGuide = (): EdgeGuideRuntime => {
  const store = createRafValueStore({
    initial: EMPTY_EDGE_GUIDE,
    isEqual: isEdgeGuideEqual
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    set: (next) => {
      if (!next) {
        store.clear()
        return
      }

      store.write(next)
    },
    clear: store.clear
  }
}
