import { atom, useAtomValue } from 'jotai'
import { createStore } from 'jotai/vanilla'
import type { EdgeId, Point } from '@whiteboard/core/types'

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
const routingPreviewAtomStore = createStore()

const setSnapshot = (next: RoutingPreviewSnapshot) => {
  const snapshot = routingPreviewAtomStore.get(routingPreviewAtom)
  if (snapshot.draft === next.draft) return
  routingPreviewAtomStore.set(routingPreviewAtom, next)
}

export const edgeRoutingPreviewStore = {
  subscribe: (listener: () => void) =>
    routingPreviewAtomStore.sub(routingPreviewAtom, listener),
  getSnapshot: () => routingPreviewAtomStore.get(routingPreviewAtom),
  setDraft: (draft: RoutingPreviewDraft) => {
    setSnapshot({ draft })
  },
  clearDraft: (pointerId?: number) => {
    const snapshot = routingPreviewAtomStore.get(routingPreviewAtom)
    if (!snapshot.draft) return
    if (pointerId !== undefined && snapshot.draft.pointerId !== pointerId) return
    setSnapshot(EMPTY_SNAPSHOT)
  },
  reset: () => {
    const snapshot = routingPreviewAtomStore.get(routingPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useEdgeRoutingPreviewState = () =>
  useAtomValue(routingPreviewAtom, { store: routingPreviewAtomStore })
