import type { NodeId } from '@whiteboard/core'
import type { NodeViewUpdate } from '@engine-types/graph'
import { isPointEqual, isSizeEqual } from '../kernel/geometry'
import {
  GraphCache
} from './cache'
import type { NodeOverride } from './overrides'
import type {
  CreateGraphProjectorOptions,
  GraphChange,
  GraphChangeSource,
  GraphProjector
} from './types'

export const createGraphProjector = ({
  getDoc
}: CreateGraphProjectorOptions): GraphProjector => {
  const cache = new GraphCache()
  const nodeOverrides = new Map<NodeId, NodeOverride>()
  const listeners = new Set<(payload: GraphChange) => void>()
  const pendingRuntimeDirtyIds = new Set<NodeId>()
  const pendingDocDirtyIds = new Set<NodeId>()
  let runtimeOrderChanged = false
  let docOrderChanged = false
  let docFullSyncRequested = false
  let runtimeFlushScheduled = false
  let currentSnapshot = cache.read(getDoc(), nodeOverrides)

  const isOptionalPointEqual = (left?: { x: number; y: number }, right?: { x: number; y: number }) => {
    if (!left && !right) return true
    if (!left || !right) return false
    return isPointEqual(left, right)
  }

  const isOverrideEqual = (
    left?: NodeOverride,
    right?: NodeOverride
  ) => {
    if (!left && !right) return true
    if (!left || !right) return false
    return isOptionalPointEqual(left.position, right.position) && isSizeEqual(left.size, right.size)
  }

  const toPayload = (
    source: GraphChangeSource,
    changed: {
      visibleNodesChanged: boolean
      canvasNodesChanged: boolean
      visibleEdgesChanged: boolean
    }
  ): GraphChange => {
    const changeFields = {
      ...(changed.visibleNodesChanged ? { visibleNodesChanged: true as const } : {}),
      ...(changed.canvasNodesChanged ? { canvasNodesChanged: true as const } : {}),
      ...(changed.visibleEdgesChanged ? { visibleEdgesChanged: true as const } : {})
    }

    if (source === 'runtime') {
      return {
        ...changeFields,
        dirtyNodeIds: pendingRuntimeDirtyIds.size
          ? Array.from(pendingRuntimeDirtyIds)
          : undefined,
        orderChanged: runtimeOrderChanged ? true : undefined
      }
    }
    if (docFullSyncRequested) {
      return {
        ...changeFields,
        fullSync: true
      }
    }
    return {
      ...changeFields,
      dirtyNodeIds: pendingDocDirtyIds.size
        ? Array.from(pendingDocDirtyIds)
        : undefined,
      orderChanged: docOrderChanged ? true : undefined
    }
  }

  const clearPending = (source: GraphChangeSource) => {
    if (source === 'runtime') {
      pendingRuntimeDirtyIds.clear()
      runtimeOrderChanged = false
      return
    }
    pendingDocDirtyIds.clear()
    docOrderChanged = false
    docFullSyncRequested = false
  }

  const hasPendingRuntime = () =>
    pendingRuntimeDirtyIds.size > 0 || runtimeOrderChanged

  const requestFrame = (callback: () => void) => {
    const runtime = globalThis as {
      requestAnimationFrame?: (task: () => void) => number
    }
    if (typeof runtime.requestAnimationFrame === 'function') {
      runtime.requestAnimationFrame(callback)
      return
    }
    setTimeout(callback, 16)
  }

  const scheduleRuntimeFlush = () => {
    if (runtimeFlushScheduled) return
    runtimeFlushScheduled = true
    requestFrame(() => {
      runtimeFlushScheduled = false
      if (!hasPendingRuntime()) return
      flush('runtime')
    })
  }

  const read = () => {
    currentSnapshot = cache.read(getDoc(), nodeOverrides)
    return currentSnapshot
  }

  const readNode: GraphProjector['readNode'] = (nodeId) =>
    cache.readNode(getDoc(), nodeOverrides, nodeId)

  const reportDirty: GraphProjector['reportDirty'] = (nodeIds, source = 'runtime') => {
    if (source === 'doc') {
      nodeIds.forEach((nodeId) => {
        pendingDocDirtyIds.add(nodeId)
      })
      return
    }
    nodeIds.forEach((nodeId) => {
      pendingRuntimeDirtyIds.add(nodeId)
    })
    if (pendingRuntimeDirtyIds.size) {
      scheduleRuntimeFlush()
    }
  }

  const flush: GraphProjector['flush'] = (source) => {
    const previous = currentSnapshot
    const next = cache.read(getDoc(), nodeOverrides)
    currentSnapshot = next
    const visibleNodesChanged = previous.visibleNodes !== next.visibleNodes
    const canvasNodesChanged = previous.canvasNodes !== next.canvasNodes
    const visibleEdgesChanged = previous.visibleEdges !== next.visibleEdges
    const payload = toPayload(source, {
      visibleNodesChanged,
      canvasNodesChanged,
      visibleEdgesChanged
    })
    const changed =
      payload.fullSync ||
      visibleNodesChanged ||
      canvasNodesChanged ||
      visibleEdgesChanged
    if (changed && listeners.size) {
      listeners.forEach((listener) => {
        listener(payload)
      })
    }
    clearPending(source)
  }

  const patchNodeOverrides: GraphProjector['patchNodeOverrides'] = (updates) => {
    if (!updates.length) return []

    const changedNodeIds: NodeId[] = []
    updates.forEach((update) => {
      if (!update.position && !update.size) return
      const current = nodeOverrides.get(update.id)
      const next: NodeOverride = {
        position: update.position ?? current?.position,
        size: update.size ?? current?.size
      }
      if (isOverrideEqual(current, next)) return
      nodeOverrides.set(update.id, next)
      changedNodeIds.push(update.id)
    })

    if (!changedNodeIds.length) return changedNodeIds
    reportDirty(changedNodeIds)
    return changedNodeIds
  }

  const clearNodeOverrides: GraphProjector['clearNodeOverrides'] = (ids) => {
    if (!nodeOverrides.size) return []

    if (!ids || !ids.length) {
      const changedNodeIds = Array.from(nodeOverrides.keys())
      nodeOverrides.clear()
      reportDirty(changedNodeIds)
      return changedNodeIds
    }

    const changedNodeIds: NodeId[] = []
    ids.forEach((id) => {
      if (!nodeOverrides.has(id)) return
      nodeOverrides.delete(id)
      changedNodeIds.push(id)
    })
    if (!changedNodeIds.length) return changedNodeIds
    reportDirty(changedNodeIds)
    return changedNodeIds
  }

  const readNodeOverrides: GraphProjector['readNodeOverrides'] = () =>
    Array.from(nodeOverrides.entries()).map(([id, override]) => ({ id, ...override }))

  return {
    read,
    readNode,
    readNodeOverrides,
    patchNodeOverrides,
    clearNodeOverrides,
    watch: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    reportDirty,
    reportOrderChanged: (source = 'runtime') => {
      if (source === 'doc') {
        docOrderChanged = true
        return
      }
      runtimeOrderChanged = true
      scheduleRuntimeFlush()
    },
    requestFullSync: () => {
      docFullSyncRequested = true
      pendingDocDirtyIds.clear()
    },
    flush
  }
}
