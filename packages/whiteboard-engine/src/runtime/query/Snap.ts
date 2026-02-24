import type { QuerySnap } from '@engine-types/instance/query'
import type { QueryIndexes } from './Indexes'

type Options = {
  indexes: QueryIndexes
  ensureIndexes: () => void
}

export const createSnap = ({
  indexes,
  ensureIndexes
}: Options): QuerySnap => {
  const candidates: QuerySnap['candidates'] = () => {
    ensureIndexes()
    return indexes.getSnapCandidates()
  }

  const candidatesInRect: QuerySnap['candidatesInRect'] = (rect) => {
    ensureIndexes()
    return indexes.getSnapCandidatesInRect(rect)
  }

  return { candidates, candidatesInRect }
}
