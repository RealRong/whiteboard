import type { Operation } from '@whiteboard/core/types'

export type HistoryCaptureInput = {
  forward: Operation[]
  inverse: Operation[]
  origin: import('@whiteboard/core/types').Origin
  timestamp: number
}

export type HistoryApplyEntry = (operations: Operation[]) => boolean
