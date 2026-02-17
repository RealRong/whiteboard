import type { NodeId, Point, Rect, Size } from '@whiteboard/core'
import type { SnapCandidate } from '../node/snap'

export type NodeOverride = {
  position?: Point
  size?: Size
}

export type NodeViewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
}

export type SnapRuntimeData = {
  enabled: boolean
  candidates: SnapCandidate[]
  getCandidates?: (rect: Rect) => SnapCandidate[]
  thresholdScreen: number
}
