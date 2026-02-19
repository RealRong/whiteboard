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
  const pendingRuntimeDirtyIds = new Set<NodeId>()
  const pendingDocDirtyIds = new Set<NodeId>()
  let runtimeOrderChanged = false
  let docOrderChanged = false
  let docFullSyncRequested = false
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
        source,
        ...changeFields,
        dirtyNodeIds: pendingRuntimeDirtyIds.size
          ? Array.from(pendingRuntimeDirtyIds)
          : undefined,
        orderChanged: runtimeOrderChanged ? true : undefined
      }
    }
    if (docFullSyncRequested) {
      return {
        source,
        ...changeFields,
        fullSync: true
      }
    }
    return {
      source,
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
  }

  const applyHint: GraphProjector['applyHint'] = (
    hint,
    source = 'doc'
  ) => {
    if (hint.forceFull) {
      if (source === 'doc') {
        docFullSyncRequested = true
        pendingDocDirtyIds.clear()
        return
      }

      // Runtime source has no dedicated fullSync flag yet, so degrade to broad dirty + order change.
      const allNodeIds = cache.read(getDoc(), nodeOverrides).canvasNodes.map(
        (node) => node.id
      )
      if (allNodeIds.length) {
        reportDirty(allNodeIds, source)
      }
      runtimeOrderChanged = true
      return
    }

    if (hint.dirtyNodeIds?.length) {
      reportDirty(hint.dirtyNodeIds, source)
    }
    if (hint.orderChanged) {
      if (source === 'doc') {
        docOrderChanged = true
      } else {
        runtimeOrderChanged = true
      }
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
    clearPending(source)
    if (!changed) return undefined
    return payload
  }

  const patchNodeOverrides: GraphProjector['patchNodeOverrides'] = (updates) => {
    if (!updates.length) return undefined

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

    if (!changedNodeIds.length) return undefined
    reportDirty(changedNodeIds)
    return flush('runtime')
  }

  const clearNodeOverrides: GraphProjector['clearNodeOverrides'] = (ids) => {
    if (!nodeOverrides.size) return undefined

    if (!ids || !ids.length) {
      const changedNodeIds = Array.from(nodeOverrides.keys())
      nodeOverrides.clear()
      reportDirty(changedNodeIds)
      return flush('runtime')
    }

    const changedNodeIds: NodeId[] = []
    ids.forEach((id) => {
      if (!nodeOverrides.has(id)) return
      nodeOverrides.delete(id)
      changedNodeIds.push(id)
    })
    if (!changedNodeIds.length) return undefined
    reportDirty(changedNodeIds)
    return flush('runtime')
  }

  const readNodeOverrides: GraphProjector['readNodeOverrides'] = () =>
    Array.from(nodeOverrides.entries()).map(([id, override]) => ({ id, ...override }))

  return {
    read,
    readNode,
    readNodeOverrides,
    patchNodeOverrides,
    clearNodeOverrides,
    applyHint,
    reportDirty,
    reportOrderChanged: (source = 'runtime') => {
      if (source === 'doc') {
        docOrderChanged = true
        return
      }
      runtimeOrderChanged = true
    },
    requestFullSync: () => {
      applyHint({ forceFull: true }, 'doc')
    },
    flush
  }
}
