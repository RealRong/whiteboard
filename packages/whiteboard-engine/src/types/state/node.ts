import type { Rect } from '@whiteboard/core'
import type { SnapCandidate } from '../node/snap'

export type SnapRuntimeData = {
  enabled: boolean
  candidates: SnapCandidate[]
  getCandidates?: (rect: Rect) => SnapCandidate[]
  thresholdScreen: number
}
