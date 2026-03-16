import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'

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

export type MindmapDraftStore = {
  get: () => MindmapDragDraft | undefined
  subscribe: (listener: () => void) => () => void
  write: (drag: MindmapDragDraft | undefined) => void
  clear: () => void
}

export type MindmapReader =
  Pick<MindmapDraftStore, 'get' | 'subscribe'>

export type MindmapWriter =
  Pick<MindmapDraftStore, 'write' | 'clear'>

export const useMindmapDraft = (
  mindmap: MindmapReader
) => useValueDraft(mindmap, () => undefined)

export const createMindmapDraftStore = (
  schedule: () => void
) => {
  const { flush, ...mindmap } = createValueDraftStore({
    schedule,
    initialValue: undefined as MindmapDragDraft | undefined,
    isEqual: (left, right) => left === right
  })

  return {
    mindmap,
    flush
  }
}
