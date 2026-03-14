import { useMemo, useSyncExternalStore } from 'react'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'

type NodeListener = () => void
type NodeDraftMap = ReadonlyMap<NodeId, NodeDraft>

export type NodePatch = {
  position?: Point
  size?: {
    width: number
    height: number
  }
  rotation?: number
}

export type NodePatchInput =
  NodePatch & {
    id: NodeId
  }

export type NodeDraft = {
  patch?: NodePatch
  hovered: boolean
}

export type NodeWriteInput = {
  patches: readonly NodePatchInput[]
  hoveredContainerId?: NodeId
}

export type TransientNode = {
  get: (nodeId: NodeId) => NodeDraft
  subscribe: (nodeId: NodeId, listener: () => void) => () => void
  write: (next: NodeWriteInput) => void
  clear: () => void
}

export type NodeReader =
  Pick<TransientNode, 'get' | 'subscribe'>

export type NodeWriter =
  Pick<TransientNode, 'write' | 'clear'>

export const EMPTY_NODE_DRAFT: NodeDraft = {
  hovered: false
}

const EMPTY_NODE_MAP: NodeDraftMap =
  new Map<NodeId, NodeDraft>()

const toNodeDraftMap = ({
  patches,
  hoveredContainerId
}: NodeWriteInput): NodeDraftMap => {
  if (!patches.length && hoveredContainerId === undefined) {
    return EMPTY_NODE_MAP
  }

  const next = new Map<NodeId, NodeDraft>()

  patches.forEach((patch) => {
    next.set(patch.id, {
      patch: {
        position: patch.position,
        size: patch.size,
        rotation: patch.rotation
      },
      hovered: hoveredContainerId === patch.id
    })
  })

  if (hoveredContainerId !== undefined && !next.has(hoveredContainerId)) {
    next.set(hoveredContainerId, {
      hovered: true
    })
  }

  return next
}

export const createTransientNode = (
  schedule: () => void
) => {
  let current = EMPTY_NODE_MAP
  let pending: NodeWriteInput | undefined
  const listenersById = new Map<NodeId, Set<NodeListener>>()

  const commit = (next: NodeDraftMap) => {
    const prev = current
    if (prev === next) return

    current = next

    const changedNodeIds = new Set<NodeId>()
    prev.forEach((_, nodeId) => {
      changedNodeIds.add(nodeId)
    })
    next.forEach((_, nodeId) => {
      changedNodeIds.add(nodeId)
    })

    changedNodeIds.forEach((nodeId) => {
      const prevDraft = prev.get(nodeId) ?? EMPTY_NODE_DRAFT
      const nextDraft = next.get(nodeId) ?? EMPTY_NODE_DRAFT
      if (
        prevDraft.patch === nextDraft.patch
        && prevDraft.hovered === nextDraft.hovered
      ) {
        return
      }
      const listeners = listenersById.get(nodeId)
      if (!listeners?.size) return
      listeners.forEach((listener) => {
        listener()
      })
    })
  }

  const node: TransientNode = {
    get: (nodeId) => current.get(nodeId) ?? EMPTY_NODE_DRAFT,
    subscribe: (nodeId, listener) => {
      let listeners = listenersById.get(nodeId)
      if (!listeners) {
        listeners = new Set<NodeListener>()
        listenersById.set(nodeId, listeners)
      }
      listeners.add(listener)

      return () => {
        const currentListeners = listenersById.get(nodeId)
        if (!currentListeners) return
        currentListeners.delete(listener)
        if (!currentListeners.size) {
          listenersById.delete(nodeId)
        }
      }
    },
    write: (next) => {
      pending = next
      schedule()
    },
    clear: () => {
      pending = undefined
      if (current === EMPTY_NODE_MAP) return
      commit(EMPTY_NODE_MAP)
    }
  }

  return {
    node,
    flush: () => {
      if (pending === undefined) return
      const next = pending
      pending = undefined
      commit(toNodeDraftMap(next))
    }
  }
}

export const applyRectDraft = (
  rect: Rect,
  draft: NodeDraft
): Rect => {
  const patch = draft.patch
  if (!patch?.position && !patch?.size) {
    return rect
  }

  return {
    x: patch.position?.x ?? rect.x,
    y: patch.position?.y ?? rect.y,
    width: patch.size?.width ?? rect.width,
    height: patch.size?.height ?? rect.height
  }
}

export const applyRotationDraft = (
  rotation: number | undefined,
  draft: NodeDraft
): number => (
  typeof draft.patch?.rotation === 'number'
    ? draft.patch.rotation
    : rotation ?? 0
)

export const applyNodeDraft = (
  item: NodeViewItem,
  draft: NodeDraft
): {
  node: NodeViewItem['node']
  rect: NodeViewItem['rect']
  hovered: boolean
  hasResizePreview: boolean
} => ({
  node: draft.patch
    ? {
      ...item.node,
      position: draft.patch.position ?? item.node.position,
      size: draft.patch.size ?? item.node.size,
      rotation:
        typeof draft.patch.rotation === 'number'
          ? draft.patch.rotation
          : item.node.rotation
    }
    : item.node,
  rect: applyRectDraft(item.rect, draft),
  hovered: draft.hovered,
  hasResizePreview: Boolean(draft.patch?.size)
})

export const applyCanvasDraft = (
  entry: {
    rect: Rect
    rotation: number
  },
  draft: NodeDraft
) => ({
  rect: applyRectDraft(entry.rect, draft),
  rotation: applyRotationDraft(entry.rotation, draft)
})

export const useTransientNode = (
  node: NodeReader,
  nodeId: NodeId | undefined
) => {
  const subscribe = useMemo(
    () => (listener: () => void) => {
      if (!nodeId) return () => {}
      return node.subscribe(nodeId, listener)
    },
    [node, nodeId]
  )
  const getSnapshot = useMemo(
    () => () => {
      if (!nodeId) return EMPTY_NODE_DRAFT
      return node.get(nodeId)
    },
    [node, nodeId]
  )

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_NODE_DRAFT
  )
}
