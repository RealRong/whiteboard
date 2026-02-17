import type {
  Document,
  Node,
  NodeId
} from '@whiteboard/core'
import type { NodeOverride } from '@engine-types/state'
import {
  GraphStateCache,
  type GraphSnapshot
} from '../state'

export type CanvasNodeChange = {
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
  fullSync?: boolean
}

export type CanvasNodeChangeSource = 'runtime' | 'doc'
type EmitSource = 'doc' | 'nodeOverrides'

export type CanvasNodes = {
  readSnapshot: () => GraphSnapshot
  readById: (nodeId: NodeId) => Node | undefined
  watch: (listener: (payload: CanvasNodeChange) => void) => () => void
  reportDirty: (nodeIds: NodeId[], source?: CanvasNodeChangeSource) => void
  reportOrderChanged: (source?: CanvasNodeChangeSource) => void
  requestFullSync: () => void
  flush: (source: EmitSource, canvasNodesChanged: boolean) => void
}

type Options = {
  getDoc: () => Document | null
  getNodeOverrides: () => Map<NodeId, NodeOverride>
}

export const createCanvasNodes = ({
  getDoc,
  getNodeOverrides
}: Options): CanvasNodes => {
  const graphCache = new GraphStateCache()
  const listeners = new Set<(payload: CanvasNodeChange) => void>()
  const pendingRuntimeDirtyIds = new Set<NodeId>()
  const pendingDocDirtyIds = new Set<NodeId>()
  let runtimeOrderChanged = false
  let docOrderChanged = false
  let docFullSyncRequested = false

  const readSnapshot: CanvasNodes['readSnapshot'] = () =>
    graphCache.get(getDoc(), getNodeOverrides())

  const readById: CanvasNodes['readById'] = (nodeId) =>
    graphCache.getCanvasNodeById(getDoc(), getNodeOverrides(), nodeId)

  const watch: CanvasNodes['watch'] = (listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const reportDirty: CanvasNodes['reportDirty'] = (
    nodeIds,
    source = 'runtime'
  ) => {
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

  const reportOrderChanged: CanvasNodes['reportOrderChanged'] = (
    source = 'runtime'
  ) => {
    if (source === 'doc') {
      docOrderChanged = true
      return
    }
    runtimeOrderChanged = true
  }

  const requestFullSync: CanvasNodes['requestFullSync'] = () => {
    docFullSyncRequested = true
    pendingDocDirtyIds.clear()
  }

  const clearPending = (source: EmitSource) => {
    if (source === 'nodeOverrides') {
      pendingRuntimeDirtyIds.clear()
      runtimeOrderChanged = false
      return
    }
    pendingDocDirtyIds.clear()
    docOrderChanged = false
    docFullSyncRequested = false
  }

  const toPayload = (source: EmitSource): CanvasNodeChange => {
    if (source === 'nodeOverrides') {
      return {
        dirtyNodeIds: pendingRuntimeDirtyIds.size
          ? Array.from(pendingRuntimeDirtyIds)
          : undefined,
        orderChanged: runtimeOrderChanged ? true : undefined
      }
    }
    if (docFullSyncRequested) {
      return {
        fullSync: true
      }
    }
    return {
      dirtyNodeIds: pendingDocDirtyIds.size
        ? Array.from(pendingDocDirtyIds)
        : undefined,
      orderChanged: docOrderChanged ? true : undefined
    }
  }

  const flush: CanvasNodes['flush'] = (source, canvasNodesChanged) => {
    if (canvasNodesChanged && listeners.size) {
      const payload = toPayload(source)
      listeners.forEach((listener) => {
        listener(payload)
      })
    }
    clearPending(source)
  }

  return {
    readSnapshot,
    readById,
    watch,
    reportDirty,
    reportOrderChanged,
    requestFullSync,
    flush
  }
}
