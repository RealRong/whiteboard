import type { Atom } from 'jotai'
import type { WhiteboardStateKey, WhiteboardStateSnapshot } from '@engine-types/instance'
import { viewportAtom, writableStateAtoms } from './whiteboardAtoms'
import { canvasNodesAtom, visibleEdgesAtom } from './whiteboardDerivedAtoms'
import { dragGuidesAtom, groupHoveredAtom, nodeViewOverridesAtom } from '../node/state'

type WhiteboardStateAtomMap = {
  [K in WhiteboardStateKey]: Atom<WhiteboardStateSnapshot[K]>
}

export const whiteboardStateAtoms: WhiteboardStateAtomMap = {
  ...writableStateAtoms,
  viewport: viewportAtom,
  dragGuides: dragGuidesAtom,
  groupHovered: groupHoveredAtom,
  nodeOverrides: nodeViewOverridesAtom,
  canvasNodes: canvasNodesAtom,
  visibleEdges: visibleEdgesAtom
}

export const WHITEBOARD_STATE_KEYS: WhiteboardStateKey[] = Object.keys(
  whiteboardStateAtoms
) as WhiteboardStateKey[]
