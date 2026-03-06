import type { Operation, Origin } from '@whiteboard/core/types'

export type HistoryCaptureInput = {
  forward: readonly Operation[]
  inverse: readonly Operation[]
  origin: Origin
}

export type HistoryReplay = (operations: readonly Operation[]) => boolean
