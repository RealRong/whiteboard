import type { Atom } from 'jotai'
import type { StateKey, StateSnapshot } from '@engine-types/instance'
import { viewportAtom, writableStateAtoms } from './atoms'
import { canvasNodesAtom, visibleEdgesAtom, visibleNodesAtom } from './derivedAtoms'
import { dragGuidesAtom, groupHoveredAtom, nodeViewOverridesAtom } from '../node/state'

type StateAtomMap = {
  [K in StateKey]: Atom<StateSnapshot[K]>
}

export const stateAtoms: StateAtomMap = {
  ...writableStateAtoms,
  viewport: viewportAtom,
  dragGuides: dragGuidesAtom,
  groupHovered: groupHoveredAtom,
  nodeOverrides: nodeViewOverridesAtom,
  visibleNodes: visibleNodesAtom,
  canvasNodes: canvasNodesAtom,
  visibleEdges: visibleEdgesAtom
}

export const STATE_KEYS: StateKey[] = Object.keys(
  stateAtoms
) as StateKey[]
