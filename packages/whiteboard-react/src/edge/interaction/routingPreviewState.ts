import { atom, useAtomValue } from 'jotai'
import type { EdgeId, Point } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'

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

const setSnapshot = (instance: Instance, next: RoutingPreviewSnapshot) => {
  const snapshot = instance.runtime.store.get(routingPreviewAtom)
  if (snapshot.draft === next.draft) return
  instance.runtime.store.set(routingPreviewAtom, next)
}

export const edgeRoutingPreviewState = {
  subscribe: (instance: Instance, listener: () => void) =>
    instance.runtime.store.sub(routingPreviewAtom, listener),
  getSnapshot: (instance: Instance) => instance.runtime.store.get(routingPreviewAtom),
  setDraft: (instance: Instance, draft: RoutingPreviewDraft) => {
    setSnapshot(instance, { draft })
  },
  clearDraft: (instance: Instance, pointerId?: number) => {
    const snapshot = instance.runtime.store.get(routingPreviewAtom)
    if (!snapshot.draft) return
    if (pointerId !== undefined && snapshot.draft.pointerId !== pointerId) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  },
  reset: (instance: Instance) => {
    const snapshot = instance.runtime.store.get(routingPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useEdgeRoutingPreviewState = () => useAtomValue(routingPreviewAtom)
