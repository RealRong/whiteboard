import type { PrimitiveAtom } from 'jotai/vanilla'
import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { InternalInstance } from '../instance/engine'
import type { Bus as ChangeBus } from './change'

export type Applied = {
  docId: string | undefined
  origin: Origin
  operations: Operation[]
  reset?: true
}

export type Options = {
  instance: InternalInstance
  changeBus: ChangeBus
  documentAtom: PrimitiveAtom<Document>
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
