import type { Atom } from 'jotai'
import type { StateKey, StateSnapshot } from '@engine-types/instance'
import { viewportAtom, writableStateAtoms } from './atoms'
import { canvasNodesAtom, visibleEdgesAtom, visibleNodesAtom } from './derivedAtoms'

type StateAtomMap = {
  [K in StateKey]: Atom<StateSnapshot[K]>
}

export const stateAtoms: StateAtomMap = {
  ...writableStateAtoms,
  viewport: viewportAtom,
  visibleNodes: visibleNodesAtom,
  canvasNodes: canvasNodesAtom,
  visibleEdges: visibleEdgesAtom
}

export const STATE_KEYS: StateKey[] = Object.keys(
  stateAtoms
) as StateKey[]
