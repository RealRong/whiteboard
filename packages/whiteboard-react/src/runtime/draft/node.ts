import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import { createKeyedDraftStore, useKeyedDraft } from './shared/keyedStore'

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
  const { flush, ...node } = createKeyedDraftStore({
    schedule,
    emptyState: EMPTY_NODE_MAP,
    emptyValue: EMPTY_NODE_DRAFT,
    build: toNodeDraftMap,
    isEqual: (left, right) => (
      left.patch === right.patch
      && left.hovered === right.hovered
    )
  })

  return {
    node,
    flush
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

const applyNodePatch = (
  node: NodeViewItem['node'],
  patch: NodePatch | undefined
): NodeViewItem['node'] => {
  if (!patch) {
    return node
  }

  const position = patch.position ?? node.position
  const size = patch.size ?? node.size
  const rotation =
    typeof patch.rotation === 'number'
      ? patch.rotation
      : node.rotation

  return {
    ...node,
    position,
    size,
    rotation
  }
}

export const applyNodeDraft = (
  item: NodeViewItem,
  draft: NodeDraft
): {
  node: NodeViewItem['node']
  rect: NodeViewItem['rect']
  hovered: boolean
  hasResizePreview: boolean
} => {
  const patch = draft.patch

  return {
    node: applyNodePatch(item.node, patch),
    rect: applyRectDraft(item.rect, draft),
    hovered: draft.hovered,
    hasResizePreview: Boolean(patch?.size)
  }
}

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
) => useKeyedDraft(node, nodeId, EMPTY_NODE_DRAFT)
