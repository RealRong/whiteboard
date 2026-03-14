import type { MindmapDragView } from '@whiteboard/engine'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'

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
