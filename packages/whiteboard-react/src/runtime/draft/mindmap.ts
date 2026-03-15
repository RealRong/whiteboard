import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'

export type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragView = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

export type TransientMindmap = {
  get: () => MindmapDragView | undefined
  subscribe: (listener: () => void) => () => void
  write: (drag: MindmapDragView | undefined) => void
  clear: () => void
}

export type MindmapReader =
  Pick<TransientMindmap, 'get' | 'subscribe'>

export type MindmapWriter =
  Pick<TransientMindmap, 'write' | 'clear'>

export const useTransientMindmap = (
  mindmap: MindmapReader
) => useValueDraft(mindmap, () => undefined)

export const createTransientMindmap = (
  schedule: () => void
) => {
  const { flush, ...mindmap } = createValueDraftStore({
    schedule,
    initialValue: undefined as MindmapDragView | undefined,
    isEqual: (left, right) => left === right
  })

  return {
    mindmap,
    flush
  }
}
