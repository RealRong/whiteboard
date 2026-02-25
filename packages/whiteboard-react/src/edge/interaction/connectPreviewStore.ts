import { useSyncExternalStore } from 'react'
import type { Point } from '@whiteboard/core/types'

type EdgeConnectPreviewSnapshot = {
  activePointerId?: number
  from?: Point
  to?: Point
  snap?: Point
  showPreviewLine: boolean
}

type ActivePreviewInput = {
  pointerId: number
  from?: Point
  to?: Point
  snap?: Point
  showPreviewLine: boolean
}

const EMPTY_SNAPSHOT: EdgeConnectPreviewSnapshot = {
  showPreviewLine: false
}

let snapshot: EdgeConnectPreviewSnapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach((listener) => listener())
}

const setSnapshot = (
  next: EdgeConnectPreviewSnapshot
) => {
  const unchanged =
    snapshot.activePointerId === next.activePointerId
    && snapshot.from === next.from
    && snapshot.to === next.to
    && snapshot.snap === next.snap
    && snapshot.showPreviewLine === next.showPreviewLine
  if (unchanged) return
  snapshot = next
  notify()
}

export const edgeConnectPreviewStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot: () => snapshot,
  setActivePreview: (preview: ActivePreviewInput) => {
    setSnapshot({
      activePointerId: preview.pointerId,
      from: preview.from,
      to: preview.to,
      snap: preview.snap,
      showPreviewLine: preview.showPreviewLine
    })
  },
  setHoverSnap: (snap: Point | undefined) => {
    if (snapshot.activePointerId !== undefined) return
    setSnapshot({
      ...snapshot,
      snap
    })
  },
  clearHoverSnap: () => {
    if (snapshot.activePointerId !== undefined) return
    if (!snapshot.snap) return
    setSnapshot({
      ...snapshot,
      snap: undefined
    })
  },
  clearActivePreview: (pointerId?: number) => {
    if (
      pointerId !== undefined
      && snapshot.activePointerId !== undefined
      && snapshot.activePointerId !== pointerId
    ) {
      return
    }
    if (snapshot.activePointerId === undefined) return
    setSnapshot(EMPTY_SNAPSHOT)
  },
  reset: () => {
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useEdgeConnectPreviewState = () =>
  useSyncExternalStore(
    edgeConnectPreviewStore.subscribe,
    edgeConnectPreviewStore.getSnapshot,
    edgeConnectPreviewStore.getSnapshot
  )
