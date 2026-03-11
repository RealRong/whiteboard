import { atom } from 'jotai/vanilla'
import type { EdgeId, Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../common/instance/types'
import { useUiAtomValue } from '../../common/hooks/useUiAtom'

export type RoutingPreviewDraft = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

export const routingPreviewDraftAtom = atom<RoutingPreviewDraft | undefined>(undefined)

const setDraft = (
  instance: InternalWhiteboardInstance,
  next: RoutingPreviewDraft | undefined
) => {
  const draft = instance.uiStore.get(routingPreviewDraftAtom)
  if (draft === next) return
  instance.uiStore.set(routingPreviewDraftAtom, next)
}

export const edgeRoutingPreviewState = {
  setDraft: (instance: InternalWhiteboardInstance, draft: RoutingPreviewDraft) => {
    setDraft(instance, draft)
  },
  clearDraft: (instance: InternalWhiteboardInstance, pointerId?: number) => {
    const draft = instance.uiStore.get(routingPreviewDraftAtom)
    if (!draft) return
    if (pointerId !== undefined && draft.pointerId !== pointerId) return
    setDraft(instance, undefined)
  },
  reset: (instance: InternalWhiteboardInstance) => {
    if (instance.uiStore.get(routingPreviewDraftAtom) === undefined) return
    setDraft(instance, undefined)
  }
}

export const useEdgeRoutingDraft = () => useUiAtomValue(routingPreviewDraftAtom)
