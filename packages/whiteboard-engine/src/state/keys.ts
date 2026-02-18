import type { StateKey } from '@engine-types/instance/state'

export type DerivedStateKey =
  | 'viewport'

export type NativeStateKey = Exclude<StateKey, DerivedStateKey>

export const DERIVED_STATE_KEYS: DerivedStateKey[] = [
  'viewport'
]

export const NATIVE_STATE_KEYS: NativeStateKey[] = [
  'interaction',
  'tool',
  'selection',
  'edgeSelection',
  'history',
  'edgeConnect',
  'routingDrag',
  'mindmapLayout',
  'mindmapDrag',
  'nodeDrag',
  'nodeTransform',
  'spacePressed',
  'dragGuides',
  'groupHovered'
]

export const STATE_KEYS: StateKey[] = [...NATIVE_STATE_KEYS, ...DERIVED_STATE_KEYS]
