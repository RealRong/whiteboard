import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { useStoreValue } from '../hooks'

export type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragDraft = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

export type MindmapDraftStore =
  Pick<StagedValueStore<MindmapDragDraft | undefined>, 'get' | 'subscribe' | 'write' | 'clear'>

export type MindmapReader =
  Pick<MindmapDraftStore, 'get' | 'subscribe'>

export type MindmapWriter =
  Pick<MindmapDraftStore, 'write' | 'clear'>

export const useMindmapDraft = (
  mindmap: MindmapReader
) => useStoreValue(mindmap)

export const createMindmapDraftStore = (
  schedule: () => void
) => {
  const { flush, ...mindmap } = createStagedValueStore({
    schedule,
    initial: undefined as MindmapDragDraft | undefined,
    isEqual: (left, right) => left === right
  })

  return {
    mindmap,
    flush
  }
}
