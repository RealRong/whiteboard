import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Operation,
  Origin
} from '../types'
import type {
  KernelProjectionInvalidation,
  KernelRebuild
} from './session'

export type KernelContext = {
  now?: () => number
  origin?: Origin
}

export type {
  KernelProjectionInvalidation,
  KernelRebuild
} from './session'

export type KernelReduceResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse: readonly Operation[]
      invalidation: KernelProjectionInvalidation
    }
  | DispatchFailure
