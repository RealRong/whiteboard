import {
  createStagedKeyedStore,
  type StagedKeyedStore
} from '@whiteboard/engine'
import type { NodeItem } from '@whiteboard/engine'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'

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

type NodeSessionPreviewWrite = {
  patches: readonly NodeSessionWritePatch[]
  hoveredContainerId?: NodeId
}

type NodeSessionWrite =
  NodeSessionPreviewWrite & {
    hiddenIds?: readonly NodeId[]
  }

export type NodeSession = {
  patch?: NodePatch
  hovered: boolean
  hidden: boolean
}

export type NodeSessionStore =
  Pick<StagedKeyedStore<NodeId, NodeSession, NodeSessionWrite>, 'get' | 'all' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type NodeSessionReader =
  Pick<NodeSessionStore, 'get' | 'subscribe'>

export type NodeFeatureRuntime = {
  session: NodeSessionStore
  clear: () => void
}

const EMPTY_NODE_SESSION: NodeSession = {
  hovered: false,
  hidden: false
}

const EMPTY_NODE_MAP: NodeSessionMap =
  new Map<NodeId, NodeSession>()

const toNodeSessionMap = ({
  patches,
  hoveredContainerId,
  hiddenIds = []
}: NodeSessionWrite): NodeSessionMap => {
  if (!patches.length && hoveredContainerId === undefined && hiddenIds.length === 0) {
    return EMPTY_NODE_MAP
  }

  const next = new Map<NodeId, NodeSession>()
  const hiddenIdSet = new Set(hiddenIds)

  patches.forEach((patch) => {
    next.set(patch.id, {
      patch: {
        position: patch.position,
        size: patch.size,
        rotation: patch.rotation
      },
      hovered: hoveredContainerId === patch.id,
      hidden: hiddenIdSet.has(patch.id)
    })
  })

  if (hoveredContainerId !== undefined && !next.has(hoveredContainerId)) {
    next.set(hoveredContainerId, {
      hovered: true,
      hidden: hiddenIdSet.has(hoveredContainerId)
    })
  }

  hiddenIds.forEach((nodeId) => {
    if (next.has(nodeId)) {
      return
    }

    next.set(nodeId, {
      hovered: false,
      hidden: true
    })
  })

  return next
}

const toNodeSessionWrite = (
  sessions: ReadonlyMap<NodeId, NodeSession>
): NodeSessionWrite => {
  const patches: NodeSessionWritePatch[] = []
  let hoveredContainerId: NodeId | undefined
  const hiddenIds: NodeId[] = []

  sessions.forEach((session, nodeId) => {
    if (session.patch) {
      patches.push({
        id: nodeId,
        ...session.patch
      })
    }
    if (session.hovered) {
      hoveredContainerId = nodeId
    }
    if (session.hidden) {
      hiddenIds.push(nodeId)
    }
  })

  return {
    patches,
    hoveredContainerId,
    hiddenIds
  }
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
    && left.hidden === right.hidden
  )
})

export const createNodeFeatureRuntime = (): NodeFeatureRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const session = createNodeSessionStore(schedule)

  flushAll.push(session.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    session,
    clear: () => {
      task.cancel()
      session.clear()
    }
  }
}

export const writeNodeSessionPatch = (
  store: NodeSessionStore,
  nodeId: NodeId,
  patch: NodePatch | undefined
) => {
  const next = new Map(store.all())
  const current = next.get(nodeId)

  if (patch) {
    next.set(nodeId, {
      hovered: current?.hovered ?? false,
      hidden: current?.hidden ?? false,
      patch
    })
  } else if (current?.hovered) {
    next.set(nodeId, {
      hovered: true,
      hidden: current.hidden
    })
  } else if (current?.hidden) {
    next.set(nodeId, {
      hovered: false,
      hidden: true
    })
  } else {
    next.delete(nodeId)
  }

  store.write(toNodeSessionWrite(next))
}

export const clearNodeSessionPatch = (
  store: NodeSessionStore,
  nodeId: NodeId
) => {
  writeNodeSessionPatch(store, nodeId, undefined)
}

const mergePreviewState = (
  sessions: ReadonlyMap<NodeId, NodeSession>,
  write: NodeSessionPreviewWrite
): NodeSessionMap => {
  const next = new Map<NodeId, NodeSession>()

  sessions.forEach((session, nodeId) => {
    if (session.hidden) {
      next.set(nodeId, {
        hovered: false,
        hidden: true
      })
    }
  })

  write.patches.forEach((patch) => {
    const current = next.get(patch.id)
    next.set(patch.id, {
      patch: {
        position: patch.position,
        size: patch.size,
        rotation: patch.rotation
      },
      hovered: write.hoveredContainerId === patch.id,
      hidden: current?.hidden ?? false
    })
  })

  if (write.hoveredContainerId !== undefined && !next.has(write.hoveredContainerId)) {
    const current = sessions.get(write.hoveredContainerId)
    next.set(write.hoveredContainerId, {
      hovered: true,
      hidden: current?.hidden ?? false
    })
  }

  return next
}

export const writeNodeSessionPreview = (
  store: NodeSessionStore,
  write: NodeSessionPreviewWrite
) => {
  store.write(toNodeSessionWrite(mergePreviewState(store.all(), write)))
}

export const clearNodeSessionPreview = (
  store: NodeSessionStore
) => {
  writeNodeSessionPreview(store, {
    patches: []
  })
}

export const writeNodeSessionHidden = (
  store: NodeSessionStore,
  hiddenIds: readonly NodeId[]
) => {
  const hiddenIdSet = new Set(hiddenIds)
  const next = new Map<NodeId, NodeSession>()

  store.all().forEach((session, nodeId) => {
    const hidden = hiddenIdSet.has(nodeId)
    if (!hidden && !session.patch && !session.hovered) {
      return
    }

    next.set(nodeId, {
      patch: session.patch,
      hovered: session.hovered,
      hidden
    })
  })

  hiddenIds.forEach((nodeId) => {
    if (next.has(nodeId)) {
      return
    }

    next.set(nodeId, {
      hovered: false,
      hidden: true
    })
  })

  store.write(toNodeSessionWrite(next))
}

export const clearNodeSessionHidden = (
  store: NodeSessionStore
) => {
  writeNodeSessionHidden(store, [])
}

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
  if (!patch || node.type === 'group') {
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
