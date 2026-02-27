import type {
  Viewport
} from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '../mindmap'
import type {
  InteractionState,
  SelectionState
} from '../state'

export type StateSnapshot = {
  interaction: InteractionState
  tool: 'select' | 'edge'
  selection: SelectionState
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
}

export type StateKey = keyof StateSnapshot
export type WritableStateSnapshot = Pick<
  StateSnapshot,
  | 'interaction'
  | 'tool'
  | 'selection'
  | 'mindmapLayout'
>
export type WritableStateKey = keyof WritableStateSnapshot

export type State = {
  read: <K extends StateKey>(key: K) => StateSnapshot[K]
  write: <K extends WritableStateKey>(
    key: K,
    next:
      | WritableStateSnapshot[K]
      | ((prev: WritableStateSnapshot[K]) => WritableStateSnapshot[K])
  ) => void
  batch: (action: () => void) => void
}
