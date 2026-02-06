import { atom } from 'jotai'
import type { Rect } from '@whiteboard/core'
import type { Guide, SnapCandidate } from '../utils/snap'

export type SnapRuntime = {
  enabled: boolean
  candidates: SnapCandidate[]
  getCandidates?: (rect: Rect) => SnapCandidate[]
  thresholdScreen: number
  zoom: number
  onGuidesChange?: (guides: Guide[]) => void
}

export const snapRuntimeAtom = atom<SnapRuntime>({
  enabled: false,
  candidates: [],
  getCandidates: undefined,
  thresholdScreen: 8,
  zoom: 1,
  onGuidesChange: undefined
})
