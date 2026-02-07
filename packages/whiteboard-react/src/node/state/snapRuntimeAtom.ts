import { atom } from 'jotai'
import type { Rect } from '@whiteboard/core'
import type { SnapCandidate } from '../utils/snap'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../utils/snap'
import { getNodeAABB } from '../../common/utils/geometry'
import { groupRuntimeDataAtom } from './groupRuntimeAtom'
import { toolAtom, viewportAtom } from '../../common/state'

export type SnapRuntimeData = {
  enabled: boolean
  candidates: SnapCandidate[]
  getCandidates?: (rect: Rect) => SnapCandidate[]
  thresholdScreen: number
  zoom: number
}

const DEFAULT_THRESHOLD = 8

export const snapRuntimeDataAtom = atom<SnapRuntimeData>((get) => {
  const groupRuntime = get(groupRuntimeDataAtom)
  const tool = get(toolAtom)
  const viewport = get(viewportAtom)
  const enabled = tool === 'select'
  const nodes = groupRuntime.nodes
  if (!nodes.length) {
    return {
      enabled,
      candidates: [],
      getCandidates: undefined,
      thresholdScreen: DEFAULT_THRESHOLD,
      zoom: viewport.zoom
    }
  }
  const snapCandidates = buildSnapCandidates(
    nodes.map((node) => ({
      id: node.id,
      rect: getNodeAABB(node, groupRuntime.nodeSize)
    }))
  )
  const snapIndex = createGridIndex(snapCandidates, 240)
  const getCandidates = (rect: Rect) => queryGridIndex(snapIndex, rect)
  return {
    enabled,
    candidates: snapCandidates,
    getCandidates,
    thresholdScreen: DEFAULT_THRESHOLD,
    zoom: viewport.zoom
  }
})
