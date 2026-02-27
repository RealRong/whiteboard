import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import { createStore } from 'jotai/vanilla'
import type { Guide } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'

export type NodePreviewUpdate = {
  id: NodeId
  position?: Point
  size?: {
    width: number
    height: number
  }
  rotation?: number
}

type NodeInteractionPreviewSnapshot = {
  updatesById: ReadonlyMap<NodeId, NodePreviewUpdate>
  guides: Guide[]
  hoveredGroupId?: NodeId
}

type Equality<T> = (left: T, right: T) => boolean

const defaultEquality: Equality<unknown> = Object.is
const EMPTY_UPDATES = new Map<NodeId, NodePreviewUpdate>()
const EMPTY_GUIDES: Guide[] = []
const EMPTY_SNAPSHOT: NodeInteractionPreviewSnapshot = {
  updatesById: EMPTY_UPDATES,
  guides: EMPTY_GUIDES,
  hoveredGroupId: undefined
}

const nodeInteractionPreviewAtom = atom<NodeInteractionPreviewSnapshot>(EMPTY_SNAPSHOT)
const nodeInteractionPreviewAtomStore = createStore()

const setSnapshot = (next: NodeInteractionPreviewSnapshot) => {
  const snapshot = nodeInteractionPreviewAtomStore.get(nodeInteractionPreviewAtom)
  const unchanged =
    snapshot.updatesById === next.updatesById
    && snapshot.guides === next.guides
    && snapshot.hoveredGroupId === next.hoveredGroupId
  if (unchanged) return
  nodeInteractionPreviewAtomStore.set(nodeInteractionPreviewAtom, next)
}

const toUpdatesById = (
  updates: readonly NodePreviewUpdate[]
): ReadonlyMap<NodeId, NodePreviewUpdate> => {
  if (!updates.length) return EMPTY_UPDATES
  const next = new Map<NodeId, NodePreviewUpdate>()
  updates.forEach((update) => {
    next.set(update.id, update)
  })
  return next
}

type SetTransientInput = {
  updates: readonly NodePreviewUpdate[]
  guides: Guide[]
  hoveredGroupId?: NodeId
}

export const nodeInteractionPreviewStore = {
  subscribe: (listener: () => void) =>
    nodeInteractionPreviewAtomStore.sub(nodeInteractionPreviewAtom, listener),
  getSnapshot: () => nodeInteractionPreviewAtomStore.get(nodeInteractionPreviewAtom),
  setTransient: ({ updates, guides, hoveredGroupId }: SetTransientInput) => {
    setSnapshot({
      updatesById: toUpdatesById(updates),
      guides: guides.length ? guides : EMPTY_GUIDES,
      hoveredGroupId
    })
  },
  clearTransient: () => {
    const snapshot = nodeInteractionPreviewAtomStore.get(nodeInteractionPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(EMPTY_SNAPSHOT)
  }
}

export const useNodeInteractionPreviewSelector = <T,>(
  selector: (snapshot: NodeInteractionPreviewSnapshot) => T,
  equality?: Equality<T>
) => {
  const snapshot = useAtomValue(nodeInteractionPreviewAtom, {
    store: nodeInteractionPreviewAtomStore
  })
  const selectorRef = useRef(selector)
  const equalityRef = useRef((equality ?? defaultEquality) as Equality<T>)
  selectorRef.current = selector
  equalityRef.current = (equality ?? defaultEquality) as Equality<T>
  const next = selectorRef.current(snapshot)
  const selectedRef = useRef(next)
  if (!equalityRef.current(selectedRef.current, next)) {
    selectedRef.current = next
  }
  return selectedRef.current
}
