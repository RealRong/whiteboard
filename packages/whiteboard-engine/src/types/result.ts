import type {
  DispatchFailureReason,
  ErrorInfo
} from '@whiteboard/core/types'
import type { Commit } from './commit'

export type CommandFailure<C extends string = DispatchFailureReason> = {
  ok: false
  error: ErrorInfo<C>
}

export type CommandResult<T = void, C extends string = DispatchFailureReason> =
  | {
      ok: true
      data: T
      commit: Commit
    }
  | CommandFailure<C>
