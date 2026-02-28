import type { QuerySnap } from '@engine-types/instance/query'
import type { IndexStore } from '../index/store'

type Options = {
  indexes: IndexStore
}

export const snap = ({
  indexes
}: Options): QuerySnap => {
  const candidates: QuerySnap['candidates'] = () =>
    indexes.getSnapCandidates()

  const candidatesInRect: QuerySnap['candidatesInRect'] = (rect) =>
    indexes.getSnapCandidatesInRect(rect)

  return { candidates, candidatesInRect }
}
