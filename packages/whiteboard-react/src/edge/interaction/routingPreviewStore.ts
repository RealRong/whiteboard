import { useSyncExternalStore } from 'react'
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

let snapshot: RoutingPreviewSnapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach((listener) => listener())
}

const setSnapshot = (next: RoutingPreviewSnapshot) => {
  if (snapshot.draft === next.draft) return
  snapshot = next
  notify()
}

export const edgeRoutingPreviewStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot: () => snapshot,
  setDraft: (draft: RoutingPreviewDraft) => {
    setSnapshot({ draft })
  },
  clearDraft: (pointerId?: number) => {
    if (!snapshot.draft) return
    if (pointerId !== undefined && snapshot.draft.pointerId !== pointerId) return
    setSnapshot(EMPTY_SNAPSHOT)
  },
  reset: () => {
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useEdgeRoutingPreviewState = () =>
  useSyncExternalStore(
    edgeRoutingPreviewStore.subscribe,
    edgeRoutingPreviewStore.getSnapshot,
    edgeRoutingPreviewStore.getSnapshot
  )
