import type { QuerySnap } from '@engine-types/instance/query'
import type { QueryIndexes } from './Indexes'

type Options = {
  indexes: QueryIndexes
  ensureIndexesSynced: () => void
}

export const createSnap = ({
  indexes,
  ensureIndexesSynced
}: Options): QuerySnap => {
  const candidates: QuerySnap['candidates'] = () => {
    ensureIndexesSynced()
    return indexes.getSnapCandidates()
  }

  const candidatesInRect: QuerySnap['candidatesInRect'] = (rect) => {
    ensureIndexesSynced()
    return indexes.getSnapCandidatesInRect(rect)
  }

  return { candidates, candidatesInRect }
}
