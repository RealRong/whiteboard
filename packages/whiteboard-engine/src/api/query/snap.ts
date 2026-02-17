import type { QueryDebugMetric, Query } from '@engine-types/instance'
import type { QueryIndexes } from './indexes'

type Options = {
  indexes: QueryIndexes
}

type SnapQuery = Pick<Query, 'getSnapCandidates' | 'getSnapCandidatesInRect'> & {
  debug: {
    getMetrics: () => QueryDebugMetric
    resetMetrics: () => void
  }
}

export const createSnap = ({
  indexes
}: Options): SnapQuery => {
  const getSnapCandidates: Query['getSnapCandidates'] = () => {
    return indexes.getSnapCandidates()
  }

  const getSnapCandidatesInRect: Query['getSnapCandidatesInRect'] = (rect) => {
    return indexes.getSnapCandidatesInRect(rect)
  }

  return {
    getSnapCandidates,
    getSnapCandidatesInRect,
    debug: {
      getMetrics: () => ({ ...indexes.getMetrics().snap } as QueryDebugMetric),
      resetMetrics: () => {
        indexes.resetMetrics('snap')
      }
    }
  }
}
