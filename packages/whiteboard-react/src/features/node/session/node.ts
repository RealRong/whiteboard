import {
  createStagedKeyedStore,
  type StagedKeyedStore
} from '@whiteboard/core/runtime'
import type { NodeItem } from '@whiteboard/core/read'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks'

type NodeSessionMap = ReadonlyMap<NodeId, NodeSession>

export type NodePatch = {
  position?: Point
  size?: {
    width: number
    height: number
  }
  rotation?: number
}

type NodeSessionWritePatch =
  NodePatch & {
    id: NodeId
  }

type NodeSessionWrite = {
  patches: readonly NodeSessionWritePatch[]
  hoveredContainerId?: NodeId
}

export type NodeSession = {
  patch?: NodePatch
  hovered: boolean
}

export type NodeSessionStore =
  Pick<StagedKeyedStore<NodeId, NodeSession, NodeSessionWrite>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type NodeSessionReader =
  Pick<NodeSessionStore, 'get' | 'subscribe'>

export type NodeSessionWriter =
  Pick<NodeSessionStore, 'write' | 'clear'>

export const EMPTY_NODE_SESSION: NodeSession = {
  hovered: false
}

const EMPTY_NODE_MAP: NodeSessionMap =
  new Map<NodeId, NodeSession>()

const toNodeSessionMap = ({
  patches,
  hoveredContainerId
}: NodeSessionWrite): NodeSessionMap => {
  if (!patches.length && hoveredContainerId === undefined) {
    return EMPTY_NODE_MAP
  }

  const next = new Map<NodeId, NodeSession>()

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

export const createNodeSessionStore = (
  schedule: () => void
) => createStagedKeyedStore({
  schedule,
  emptyState: EMPTY_NODE_MAP,
  emptyValue: EMPTY_NODE_SESSION,
  build: toNodeSessionMap,
  isEqual: (left, right) => (
    left.patch === right.patch
    && left.hovered === right.hovered
  )
})

const applyRectPatch = (
  rect: Rect,
  patch: NodePatch | undefined
): Rect => {
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

const applyNodePatch = (
  node: NodeItem['node'],
  patch: NodePatch | undefined
): NodeItem['node'] => {
  if (!patch) {
    return node
  }

  const position = patch.position ?? node.position
  const size = patch.size ?? node.size
  const rotation =
    typeof patch.rotation === 'number'
      ? patch.rotation
      : node.rotation

  if (
    position === node.position
    && size === node.size
    && rotation === node.rotation
  ) {
    return node
  }

  return {
    ...node,
    position,
    size,
    rotation
  }
}

export const projectNodeItem = (
  item: NodeItem,
  session: NodeSession
): NodeItem => {
  const patch = session.patch
  if (!patch) {
    return item
  }

  const node = applyNodePatch(item.node, patch)
  const rect = applyRectPatch(item.rect, patch)

  if (node === item.node && rect === item.rect) {
    return item
  }

  return {
    node,
    rect
  }
}

export const useNodeSession = (
  store: NodeSessionReader,
  nodeId: NodeId | undefined
) => useOptionalKeyedStoreValue(store, nodeId, EMPTY_NODE_SESSION)
