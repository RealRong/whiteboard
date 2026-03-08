import { atom, useAtomValue } from 'jotai'
import type { Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../common/instance/types'

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

const setSnapshot = (
  instance: InternalWhiteboardInstance,
  next: EdgeConnectPreviewSnapshot
) => {
  const snapshot = instance.uiStore.get(edgeConnectPreviewAtom)
  const unchanged =
    snapshot.activePointerId === next.activePointerId
    && snapshot.from === next.from
    && snapshot.to === next.to
    && snapshot.snap === next.snap
    && snapshot.showPreviewLine === next.showPreviewLine
  if (unchanged) return
  instance.uiStore.set(edgeConnectPreviewAtom, next)
}

export const edgeConnectPreviewState = {
  subscribe: (instance: InternalWhiteboardInstance, listener: () => void) =>
    instance.uiStore.sub(edgeConnectPreviewAtom, listener),
  getSnapshot: (instance: InternalWhiteboardInstance) => instance.uiStore.get(edgeConnectPreviewAtom),
  setActivePreview: (instance: InternalWhiteboardInstance, preview: ActivePreviewInput) => {
    setSnapshot(instance, {
      activePointerId: preview.pointerId,
      from: preview.from,
      to: preview.to,
      snap: preview.snap,
      showPreviewLine: preview.showPreviewLine
    })
  },
  setHoverSnap: (instance: InternalWhiteboardInstance, snap: Point | undefined) => {
    const snapshot = instance.uiStore.get(edgeConnectPreviewAtom)
    if (snapshot.activePointerId !== undefined) return
    setSnapshot(instance, {
      ...snapshot,
      snap
    })
  },
  clearHoverSnap: (instance: InternalWhiteboardInstance) => {
    const snapshot = instance.uiStore.get(edgeConnectPreviewAtom)
    if (snapshot.activePointerId !== undefined) return
    if (!snapshot.snap) return
    setSnapshot(instance, {
      ...snapshot,
      snap: undefined
    })
  },
  clearActivePreview: (instance: InternalWhiteboardInstance, pointerId?: number) => {
    const snapshot = instance.uiStore.get(edgeConnectPreviewAtom)
    if (
      pointerId !== undefined
      && snapshot.activePointerId !== undefined
      && snapshot.activePointerId !== pointerId
    ) {
      return
    }
    if (snapshot.activePointerId === undefined) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  },
  reset: (instance: InternalWhiteboardInstance) => {
    const snapshot = instance.uiStore.get(edgeConnectPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useEdgeConnectPreviewState = () => useAtomValue(edgeConnectPreviewAtom)
