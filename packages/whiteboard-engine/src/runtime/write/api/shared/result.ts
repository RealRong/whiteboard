import type { DispatchFailureReason, DispatchResult } from '@whiteboard/core/types'

const failureResult = (
  reason: DispatchFailureReason,
  message?: string
): Promise<DispatchResult> =>
  Promise.resolve({
    ok: false,
    reason,
    message
  })

export const invalidResult = (message: string): Promise<DispatchResult> =>
  failureResult('invalid', message)

export const cancelledResult = (message?: string): Promise<DispatchResult> =>
  failureResult('cancelled', message)
