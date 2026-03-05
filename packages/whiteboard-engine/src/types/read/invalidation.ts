import type { EdgeChange, IndexChange } from './change'

export type ReadInvalidation = {
  index: IndexChange
  edge: EdgeChange
}
