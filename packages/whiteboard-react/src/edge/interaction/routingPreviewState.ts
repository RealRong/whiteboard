import { atom, useAtomValue } from 'jotai'
import type { EdgeId, Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../common/instance/types'

export type RoutingPreviewDraft = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

type RoutingPreviewSnapshot = {
  draft?: RoutingPreviewDraft
}

const EMPTY_SNAPSHOT: RoutingPreviewSnapshot = {}

const routingPreviewAtom = atom<RoutingPreviewSnapshot>(EMPTY_SNAPSHOT)

const setSnapshot = (instance: InternalWhiteboardInstance, next: RoutingPreviewSnapshot) => {
  const snapshot = instance.uiStore.get(routingPreviewAtom)
  if (snapshot.draft === next.draft) return
  instance.uiStore.set(routingPreviewAtom, next)
}

export const edgeRoutingPreviewState = {
  subscribe: (instance: InternalWhiteboardInstance, listener: () => void) =>
    instance.uiStore.sub(routingPreviewAtom, listener),
  getSnapshot: (instance: InternalWhiteboardInstance) => instance.uiStore.get(routingPreviewAtom),
  setDraft: (instance: InternalWhiteboardInstance, draft: RoutingPreviewDraft) => {
    setSnapshot(instance, { draft })
  },
  clearDraft: (instance: InternalWhiteboardInstance, pointerId?: number) => {
    const snapshot = instance.uiStore.get(routingPreviewAtom)
    if (!snapshot.draft) return
    if (pointerId !== undefined && snapshot.draft.pointerId !== pointerId) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  },
  reset: (instance: InternalWhiteboardInstance) => {
    const snapshot = instance.uiStore.get(routingPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useEdgeRoutingPreviewState = () => useAtomValue(routingPreviewAtom)
