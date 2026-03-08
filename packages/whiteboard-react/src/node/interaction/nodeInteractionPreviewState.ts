import { useRef } from 'react'
import { atom, useAtomValue } from 'jotai'
import type { Guide } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../common/instance/types'

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

const setSnapshot = (instance: InternalWhiteboardInstance, next: NodeInteractionPreviewSnapshot) => {
  const snapshot = instance.uiStore.get(nodeInteractionPreviewAtom)
  const unchanged =
    snapshot.updatesById === next.updatesById
    && snapshot.guides === next.guides
    && snapshot.hoveredGroupId === next.hoveredGroupId
  if (unchanged) return
  instance.uiStore.set(nodeInteractionPreviewAtom, next)
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

export const nodeInteractionPreviewState = {
  subscribe: (instance: InternalWhiteboardInstance, listener: () => void) =>
    instance.uiStore.sub(nodeInteractionPreviewAtom, listener),
  getSnapshot: (instance: InternalWhiteboardInstance) => instance.uiStore.get(nodeInteractionPreviewAtom),
  setTransient: (
    instance: InternalWhiteboardInstance,
    { updates, guides, hoveredGroupId }: SetTransientInput
  ) => {
    setSnapshot(instance, {
      updatesById: toUpdatesById(updates),
      guides: guides.length ? guides : EMPTY_GUIDES,
      hoveredGroupId
    })
  },
  clearTransient: (instance: InternalWhiteboardInstance) => {
    const snapshot = instance.uiStore.get(nodeInteractionPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useNodeInteractionPreviewSelector = <T,>(
  selector: (snapshot: NodeInteractionPreviewSnapshot) => T,
  equality?: Equality<T>
) => {
  const snapshot = useAtomValue(nodeInteractionPreviewAtom)
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
