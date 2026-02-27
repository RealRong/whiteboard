import type { QuerySnap } from '@engine-types/instance/query'
import type { QueryIndexes } from '../indexes/QueryIndexes'

type Options = {
  indexes: QueryIndexes
}

export const createSnap = ({
  indexes
}: Options): QuerySnap => {
  const candidates: QuerySnap['candidates'] = () =>
    indexes.getSnapCandidates()

  const candidatesInRect: QuerySnap['candidatesInRect'] = (rect) =>
    indexes.getSnapCandidatesInRect(rect)

  return { candidates, candidatesInRect }
}
