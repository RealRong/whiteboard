import type { PrimitiveAtom } from 'jotai/vanilla'
import type {
  ChangeSet,
  DispatchFailure,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { Bus as ChangeBus } from './change'
import type { WriteRuntimeInstance } from './deps'

export type Applied = {
  docId: string | undefined
  origin: Origin
  operations: Operation[]
  reset?: true
}

export type Options = {
  instance: WriteRuntimeInstance
  changeBus: ChangeBus
  readModelRevisionAtom: PrimitiveAtom<number>
  now?: () => number
}

export type ApplyResult =
  | {
      ok: true
      changes: ChangeSet
      inverse: Operation[]
      applied: Applied
    }
  | DispatchFailure

export type ResetResult = {
  ok: true
  changes: ChangeSet
  applied: Applied
}
