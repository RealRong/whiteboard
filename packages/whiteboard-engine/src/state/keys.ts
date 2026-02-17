import type { StateKey } from '@engine-types/instance'

export type DerivedStateKey =
  | 'viewport'
  | 'visibleNodes'
  | 'canvasNodes'
  | 'visibleEdges'

export type NativeStateKey = Exclude<StateKey, DerivedStateKey>

export const DERIVED_STATE_KEYS: DerivedStateKey[] = [
  'viewport',
  'visibleNodes',
  'canvasNodes',
  'visibleEdges'
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
  'groupHovered',
  'nodeOverrides'
]

export const STATE_KEYS: StateKey[] = [...NATIVE_STATE_KEYS, ...DERIVED_STATE_KEYS]
