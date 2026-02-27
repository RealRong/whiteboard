import { atom, useAtomValue } from 'jotai'
import { createStore } from 'jotai/vanilla'
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

const edgeConnectPreviewAtom = atom<EdgeConnectPreviewSnapshot>(EMPTY_SNAPSHOT)
const edgeConnectPreviewAtomStore = createStore()

const setSnapshot = (
  next: EdgeConnectPreviewSnapshot
) => {
  const snapshot = edgeConnectPreviewAtomStore.get(edgeConnectPreviewAtom)
  const unchanged =
    snapshot.activePointerId === next.activePointerId
    && snapshot.from === next.from
    && snapshot.to === next.to
    && snapshot.snap === next.snap
    && snapshot.showPreviewLine === next.showPreviewLine
  if (unchanged) return
  edgeConnectPreviewAtomStore.set(edgeConnectPreviewAtom, next)
}

export const edgeConnectPreviewStore = {
  subscribe: (listener: () => void) =>
    edgeConnectPreviewAtomStore.sub(edgeConnectPreviewAtom, listener),
  getSnapshot: () => edgeConnectPreviewAtomStore.get(edgeConnectPreviewAtom),
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
    const snapshot = edgeConnectPreviewAtomStore.get(edgeConnectPreviewAtom)
    if (snapshot.activePointerId !== undefined) return
    setSnapshot({
      ...snapshot,
      snap
    })
  },
  clearHoverSnap: () => {
    const snapshot = edgeConnectPreviewAtomStore.get(edgeConnectPreviewAtom)
    if (snapshot.activePointerId !== undefined) return
    if (!snapshot.snap) return
    setSnapshot({
      ...snapshot,
      snap: undefined
    })
  },
  clearActivePreview: (pointerId?: number) => {
    const snapshot = edgeConnectPreviewAtomStore.get(edgeConnectPreviewAtom)
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
    const snapshot = edgeConnectPreviewAtomStore.get(edgeConnectPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useEdgeConnectPreviewState = () =>
  useAtomValue(edgeConnectPreviewAtom, { store: edgeConnectPreviewAtomStore })
