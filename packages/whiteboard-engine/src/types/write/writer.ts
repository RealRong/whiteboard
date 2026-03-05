import type { PrimitiveAtom } from 'jotai/vanilla'
import type {
  ChangeSet,
  DispatchFailure,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { Bus as ChangeBus } from './change'
import type { WriteInstance } from './deps'
import type { ReadInvalidation } from '../read/invalidation'

export type Applied = {
  docId: string | undefined
  origin: Origin
  operations: readonly Operation[]
  reset?: true
}

export type Options = {
  instance: WriteInstance
  changeBus: ChangeBus
  readModelRevisionAtom: PrimitiveAtom<number>
  project: (invalidation: ReadInvalidation) => void
  now?: () => number
}

export type ApplyResult =
  | {
      ok: true
      changes: ChangeSet
      inverse: readonly Operation[]
      applied: Applied
    }
  | DispatchFailure

export type ResetResult = {
  ok: true
  changes: ChangeSet
  applied: Applied
}
