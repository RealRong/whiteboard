import {
  createStagedKeyedStore,
  type StagedKeyedStore
} from '@whiteboard/engine'
import type { NodeItem } from '@whiteboard/engine'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'

type NodeProjectionMap = ReadonlyMap<NodeId, NodeProjection>

export type NodePatch = {
  position?: Point
  size?: {
    width: number
    height: number
  }
  rotation?: number
}

type NodeProjectionWritePatch =
  NodePatch & {
    id: NodeId
  }

type NodeProjectionPreviewWrite = {
  patches: readonly NodeProjectionWritePatch[]
  hoveredContainerId?: NodeId
}

type NodeProjectionWrite =
  NodeProjectionPreviewWrite & {
    hiddenIds?: readonly NodeId[]
  }

type NodeProjectionPatchRuntime = {
  write: (nodeId: NodeId, patch?: NodePatch) => void
  clear: (nodeId: NodeId) => void
}

type NodeProjectionPreviewRuntime = {
  write: (write: NodeProjectionPreviewWrite) => void
  clear: () => void
}

type NodeProjectionHiddenRuntime = {
  write: (hiddenIds: readonly NodeId[]) => void
  clear: () => void
}

export type NodeProjection = {
  patch?: NodePatch
  hovered: boolean
  hidden: boolean
}

export type NodeProjectionStore =
  Pick<StagedKeyedStore<NodeId, NodeProjection, NodeProjectionWrite>, 'get' | 'all' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type NodeProjectionReader =
  Pick<NodeProjectionStore, 'get' | 'subscribe'>

export type NodeProjectionRuntime = {
  store: NodeProjectionStore
  patch: NodeProjectionPatchRuntime
  preview: NodeProjectionPreviewRuntime
  hidden: NodeProjectionHiddenRuntime
  clear: () => void
}

const EMPTY_NODE_PROJECTION: NodeProjection = {
  hovered: false,
  hidden: false
}

const EMPTY_NODE_MAP: NodeProjectionMap =
  new Map<NodeId, NodeProjection>()

const toNodeProjectionMap = ({
  patches,
  hoveredContainerId,
  hiddenIds = []
}: NodeProjectionWrite): NodeProjectionMap => {
  if (!patches.length && hoveredContainerId === undefined && hiddenIds.length === 0) {
    return EMPTY_NODE_MAP
  }

  const next = new Map<NodeId, NodeProjection>()
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

const toNodeProjectionWrite = (
  projections: ReadonlyMap<NodeId, NodeProjection>
): NodeProjectionWrite => {
  const patches: NodeProjectionWritePatch[] = []
  let hoveredContainerId: NodeId | undefined
  const hiddenIds: NodeId[] = []

  projections.forEach((projection, nodeId) => {
    if (projection.patch) {
      patches.push({
        id: nodeId,
        ...projection.patch
      })
    }
    if (projection.hovered) {
      hoveredContainerId = nodeId
    }
    if (projection.hidden) {
      hiddenIds.push(nodeId)
    }
  })

  return {
    patches,
    hoveredContainerId,
    hiddenIds
  }
}

export const createNodeProjectionStore = (
  schedule: () => void
) => createStagedKeyedStore({
  schedule,
  emptyState: EMPTY_NODE_MAP,
  emptyValue: EMPTY_NODE_PROJECTION,
  build: toNodeProjectionMap,
  isEqual: (left, right) => (
    left.patch === right.patch
    && left.hovered === right.hovered
    && left.hidden === right.hidden
  )
})

export const createNodeProjectionRuntime = (): NodeProjectionRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const store = createNodeProjectionStore(schedule)

  flushAll.push(store.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    store,
    patch: {
      write: (nodeId, patch) => {
        writeNodeProjectionPatch(store, nodeId, patch)
      },
      clear: (nodeId) => {
        clearNodeProjectionPatch(store, nodeId)
      }
    },
    preview: {
      write: (write) => {
        writeNodeProjectionPreview(store, write)
      },
      clear: () => {
        clearNodeProjectionPreview(store)
      }
    },
    hidden: {
      write: (hiddenIds) => {
        writeNodeProjectionHidden(store, hiddenIds)
      },
      clear: () => {
        clearNodeProjectionHidden(store)
      }
    },
    clear: () => {
      task.cancel()
      store.clear()
    }
  }
}

export const writeNodeProjectionPatch = (
  store: NodeProjectionStore,
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

  store.write(toNodeProjectionWrite(next))
}

export const clearNodeProjectionPatch = (
  store: NodeProjectionStore,
  nodeId: NodeId
) => {
  writeNodeProjectionPatch(store, nodeId, undefined)
}

const mergePreviewState = (
  projections: ReadonlyMap<NodeId, NodeProjection>,
  write: NodeProjectionPreviewWrite
): NodeProjectionMap => {
  const next = new Map<NodeId, NodeProjection>()

  projections.forEach((projection, nodeId) => {
    if (projection.hidden) {
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
    const current = projections.get(write.hoveredContainerId)
    next.set(write.hoveredContainerId, {
      hovered: true,
      hidden: current?.hidden ?? false
    })
  }

  return next
}

export const writeNodeProjectionPreview = (
  store: NodeProjectionStore,
  write: NodeProjectionPreviewWrite
) => {
  store.write(toNodeProjectionWrite(mergePreviewState(store.all(), write)))
}

export const clearNodeProjectionPreview = (
  store: NodeProjectionStore
) => {
  writeNodeProjectionPreview(store, {
    patches: []
  })
}

export const writeNodeProjectionHidden = (
  store: NodeProjectionStore,
  hiddenIds: readonly NodeId[]
) => {
  const hiddenIdSet = new Set(hiddenIds)
  const next = new Map<NodeId, NodeProjection>()

  store.all().forEach((projection, nodeId) => {
    const hidden = hiddenIdSet.has(nodeId)
    if (!hidden && !projection.patch && !projection.hovered) {
      return
    }

    next.set(nodeId, {
      patch: projection.patch,
      hovered: projection.hovered,
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

  store.write(toNodeProjectionWrite(next))
}

export const clearNodeProjectionHidden = (
  store: NodeProjectionStore
) => {
  writeNodeProjectionHidden(store, [])
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
  projection: NodeProjection
): NodeItem => {
  const patch = projection.patch
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
