import type {
  EdgeId,
  NodeId,
  Viewport
} from '@whiteboard/core'
import type { MindmapLayoutConfig } from '../mindmap'
import type { Guide } from '../node/snap'
import type {
  EdgeConnectState,
  HistoryState,
  InteractionState,
  MindmapDragState,
  NodeDragState,
  NodeTransformState,
  RoutingDragState,
  SelectionState
} from '../state'

export type StateSnapshot = {
  interaction: InteractionState
  tool: 'select' | 'edge'
  selection: SelectionState
  edgeSelection: EdgeId | undefined
  history: HistoryState
  edgeConnect: EdgeConnectState
  routingDrag: RoutingDragState
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
  mindmapDrag: MindmapDragState
  nodeDrag: NodeDragState
  nodeTransform: NodeTransformState
  spacePressed: boolean
  dragGuides: Guide[]
  groupHovered: NodeId | undefined
}

export type StateKey = keyof StateSnapshot
export type WritableStateSnapshot = Pick<
  StateSnapshot,
  | 'interaction'
  | 'tool'
  | 'selection'
  | 'edgeSelection'
  | 'history'
  | 'edgeConnect'
  | 'routingDrag'
  | 'mindmapLayout'
  | 'mindmapDrag'
  | 'nodeDrag'
  | 'nodeTransform'
  | 'spacePressed'
  | 'dragGuides'
  | 'groupHovered'
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
  batchFrame: (action: () => void) => void
  watchChanges: (listener: (key: StateKey) => void) => () => void
  watch: (key: StateKey, listener: () => void) => () => void
}
