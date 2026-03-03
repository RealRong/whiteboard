import type { Operation } from '@whiteboard/core/types'

export type HistoryCaptureInput = {
  forward: readonly Operation[]
  inverse: readonly Operation[]
  origin: import('@whiteboard/core/types').Origin
  timestamp: number
}

export type HistoryApplyEntry = (operations: readonly Operation[]) => boolean
