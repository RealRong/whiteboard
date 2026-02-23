import type { QueryDebugMetric, QuerySnap } from '@engine-types/instance/query'
import type { QueryIndexes } from './Indexes'

type Options = {
  indexes: QueryIndexes
}

type SnapQuery = {
  query: QuerySnap
  debug: {
    getMetrics: () => QueryDebugMetric
    resetMetrics: () => void
  }
}

export const createSnap = ({
  indexes
}: Options): SnapQuery => {
  const candidates: QuerySnap['candidates'] = () => {
    return indexes.getSnapCandidates()
  }

  const candidatesInRect: QuerySnap['candidatesInRect'] = (rect) => {
    return indexes.getSnapCandidatesInRect(rect)
  }

  return {
    query: {
      candidates,
      candidatesInRect
    },
    debug: {
      getMetrics: () => ({ ...indexes.getMetrics().snap } as QueryDebugMetric),
      resetMetrics: () => {
        indexes.resetMetrics('snap')
      }
    }
  }
}
