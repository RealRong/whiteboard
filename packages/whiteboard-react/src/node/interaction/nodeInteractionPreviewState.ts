import { useMemo } from 'react'
import { atom } from 'jotai'
import type { Guide } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../common/instance/types'
import { useUiAtomValue } from '../../common/hooks/useUiAtom'
import { createRafTask } from '../../common/utils/rafTask'

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

const EMPTY_UPDATES = new Map<NodeId, NodePreviewUpdate>()
const EMPTY_GUIDES: Guide[] = []
const EMPTY_SNAPSHOT: NodeInteractionPreviewSnapshot = {
  updatesById: EMPTY_UPDATES,
  guides: EMPTY_GUIDES,
  hoveredGroupId: undefined
}

export const nodeInteractionPreviewAtom = atom<NodeInteractionPreviewSnapshot>(EMPTY_SNAPSHOT)
const nodeInteractionGuidesAtom = atom((get) => get(nodeInteractionPreviewAtom).guides)

const pendingByInstance = new WeakMap<InternalWhiteboardInstance, NodeInteractionPreviewSnapshot>()
const flushTaskByInstance = new WeakMap<InternalWhiteboardInstance, ReturnType<typeof createRafTask>>()

const setSnapshot = (instance: InternalWhiteboardInstance, next: NodeInteractionPreviewSnapshot) => {
  const snapshot = instance.uiStore.get(nodeInteractionPreviewAtom)
  const unchanged =
    snapshot.updatesById === next.updatesById
    && snapshot.guides === next.guides
    && snapshot.hoveredGroupId === next.hoveredGroupId
  if (unchanged) return
  instance.uiStore.set(nodeInteractionPreviewAtom, next)
}

const flushPending = (instance: InternalWhiteboardInstance) => {
  const pending = pendingByInstance.get(instance)
  if (!pending) return
  pendingByInstance.delete(instance)
  setSnapshot(instance, pending)
}

const getFlushTask = (instance: InternalWhiteboardInstance) => {
  let task = flushTaskByInstance.get(instance)
  if (task) return task
  task = createRafTask(() => flushPending(instance), { fallback: 'microtask' })
  flushTaskByInstance.set(instance, task)
  return task
}

const scheduleFlush = (instance: InternalWhiteboardInstance) => {
  getFlushTask(instance).schedule()
}

const cancelFlush = (instance: InternalWhiteboardInstance) => {
  const task = flushTaskByInstance.get(instance)
  if (!task) return
  task.cancel()
  flushTaskByInstance.delete(instance)
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
  setTransient: (
    instance: InternalWhiteboardInstance,
    { updates, guides, hoveredGroupId }: SetTransientInput
  ) => {
    pendingByInstance.set(instance, {
      updatesById: toUpdatesById(updates),
      guides: guides.length ? guides : EMPTY_GUIDES,
      hoveredGroupId
    })
    scheduleFlush(instance)
  },
  clearTransient: (instance: InternalWhiteboardInstance) => {
    const snapshot = instance.uiStore.get(nodeInteractionPreviewAtom)
    if (snapshot === EMPTY_SNAPSHOT) return
    pendingByInstance.delete(instance)
    cancelFlush(instance)
    setSnapshot(instance, EMPTY_SNAPSHOT)
  }
}

export const useNodePreviewUpdate = (nodeId: NodeId) => {
  const previewUpdateAtom = useMemo(
    () => atom((get) => get(nodeInteractionPreviewAtom).updatesById.get(nodeId)),
    [nodeId]
  )
  return useUiAtomValue(previewUpdateAtom)
}

export const useNodeHoveredGroup = (nodeId: NodeId) => {
  const hoveredGroupAtom = useMemo(
    () => atom((get) => get(nodeInteractionPreviewAtom).hoveredGroupId === nodeId),
    [nodeId]
  )
  return useUiAtomValue(hoveredGroupAtom)
}

export const useNodeInteractionGuides = () => useUiAtomValue(nodeInteractionGuidesAtom)
