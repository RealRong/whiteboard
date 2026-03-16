import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { useStoreValue } from '../../../runtime/hooks'

type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragState = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

export type MindmapDragSessionStore =
  Pick<StagedValueStore<MindmapDragState | undefined>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type MindmapDragSessionReader =
  Pick<MindmapDragSessionStore, 'get' | 'subscribe'>

export const createMindmapDragSessionStore = (
  schedule: () => void
) => createStagedValueStore({
  schedule,
  initial: undefined as MindmapDragState | undefined,
  isEqual: (left, right) => left === right
})

export const useMindmapDragSession = (
  store: MindmapDragSessionReader
) => useStoreValue(store)
