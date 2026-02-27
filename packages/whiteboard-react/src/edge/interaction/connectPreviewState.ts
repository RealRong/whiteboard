import { atom, useAtomValue } from 'jotai'
import type { Point } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'

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
  instance: Instance,
  next: EdgeConnectPreviewSnapshot
) => {
  const snapshot = instance.runtime.store.get(edgeConnectPreviewAtom)
  const unchanged =
    snapshot.activePointerId === next.activePointerId
    && snapshot.from === next.from
    && snapshot.to === next.to
    && snapshot.snap === next.snap
    && snapshot.showPreviewLine === next.showPreviewLine
  if (unchanged) return
  instance.runtime.store.set(edgeConnectPreviewAtom, next)
}

export const edgeConnectPreviewState = {
  subscribe: (instance: Instance, listener: () => void) =>
    instance.runtime.store.sub(edgeConnectPreviewAtom, listener),
  getSnapshot: (instance: Instance) => instance.runtime.store.get(edgeConnectPreviewAtom),
  setActivePreview: (instance: Instance, preview: ActivePreviewInput) => {
    setSnapshot(instance, {
      activePointerId: preview.pointerId,
      from: preview.from,
      to: preview.to,
      snap: preview.snap,
      showPreviewLine: preview.showPreviewLine
    })
  },
  setHoverSnap: (instance: Instance, snap: Point | undefined) => {
    const snapshot = instance.runtime.store.get(edgeConnectPreviewAtom)
    if (snapshot.activePointerId !== undefined) return
    setSnapshot(instance, {
      ...snapshot,
      snap
    })
  },
  clearHoverSnap: (instance: Instance) => {
    const snapshot = instance.runtime.store.get(edgeConnectPreviewAtom)
    if (snapshot.activePointerId !== undefined) return
    if (!snapshot.snap) return
    setSnapshot(instance, {
      ...snapshot,
      snap: undefined
    })
  },
  clearActivePreview: (instance: Instance, pointerId?: number) => {
    const snapshot = instance.runtime.store.get(edgeConnectPreviewAtom)
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
  reset: (instance: Instance) => {
    const snapshot = instance.runtime.store.get(edgeConnectPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useEdgeConnectPreviewState = () => useAtomValue(edgeConnectPreviewAtom)
