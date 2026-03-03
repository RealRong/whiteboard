import type { ReadInvalidation } from '../read/invalidation'
import type { QueryFacade, ReadFacade } from './query'

export type ProjectionRuntime = {
  applyInvalidation: (invalidation: ReadInvalidation) => void
  query: QueryFacade
  read: ReadFacade
}
