import type { Document } from '@whiteboard/core'
import type { Viewport } from '@whiteboard/core'
import type { NodeId } from '@whiteboard/core'
import type {
  State,
  StateKey,
  StateSnapshot,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance'
import { GraphStateCache, WritableStore } from '../../kernel/state'
import { DERIVED_STATE_KEYS, STATE_KEYS } from '../keys'
import type { DerivedStateKey, NativeStateKey } from '../keys'
import { createWritableStateSnapshot } from '../writable'

type Result = {
  state: State
  readState: State['read']
  writeState: State['write']
}

type Options = {
  doc?: Document | null
}

const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

type DerivedSnapshot = Pick<StateSnapshot, DerivedStateKey>

const toViewport = (
  doc: Document | null,
  previous?: Viewport
): Viewport => {
  const source = doc?.viewport
  const nextCenterX = source?.center?.x ?? DEFAULT_VIEWPORT.center.x
  const nextCenterY = source?.center?.y ?? DEFAULT_VIEWPORT.center.y
  const nextZoom = source?.zoom ?? DEFAULT_VIEWPORT.zoom

  if (
    previous &&
    previous.center.x === nextCenterX &&
    previous.center.y === nextCenterY &&
    previous.zoom === nextZoom
  ) {
    return previous
  }

  return {
    center: { x: nextCenterX, y: nextCenterY },
    zoom: nextZoom
  }
}

export const createState = ({ doc = null }: Options = {}): Result => {
  const store = new WritableStore<WritableStateSnapshot>(
    createWritableStateSnapshot()
  )
  let currentDoc = doc
  const graphCache = new GraphStateCache()
  const canvasNodeChangeListeners = new Set<
    (payload: {
      dirtyNodeIds?: NodeId[]
      orderChanged?: boolean
      fullSync?: boolean
    }) => void
  >()
  const pendingRuntimeCanvasNodeDirtyIds = new Set<NodeId>()
  const pendingDocCanvasNodeDirtyIds = new Set<NodeId>()
  let runtimeCanvasNodeOrderChanged = false
  let docCanvasNodeOrderChanged = false
  let docCanvasNodeFullSyncRequested = false
  const derivedListeners = new Map<DerivedStateKey, Set<() => void>>(
    DERIVED_STATE_KEYS.map((key) => [key, new Set()])
  )
  const isDerivedStateKey = (key: StateKey): key is DerivedStateKey =>
    key === 'viewport' ||
    key === 'visibleNodes' ||
    key === 'canvasNodes' ||
    key === 'visibleEdges'

  const readDerivedSnapshot = (previous?: DerivedSnapshot): DerivedSnapshot => {
    const nodeOverrides = store.get('nodeOverrides')
    const graphSnapshot = graphCache.get(currentDoc, nodeOverrides)

    return {
      viewport: toViewport(currentDoc, previous?.viewport),
      visibleNodes: graphSnapshot.visibleNodes,
      canvasNodes: graphSnapshot.canvasNodes,
      visibleEdges: graphSnapshot.visibleEdges
    }
  }

  let derivedSnapshot = readDerivedSnapshot()

  const readState = ((key: StateKey) => {
    if (isDerivedStateKey(key)) {
      derivedSnapshot = readDerivedSnapshot(derivedSnapshot)
      return derivedSnapshot[key]
    }
    return store.get(key as NativeStateKey) as StateSnapshot[NativeStateKey]
  }) as State['read']

  const emitDerivedChanges = (source: 'doc' | 'nodeOverrides') => {
    const nextSnapshot = readDerivedSnapshot(derivedSnapshot)
    let canvasNodesChanged = false
    const canvasPayload = (() => {
      if (source === 'nodeOverrides') {
        return {
          dirtyNodeIds: pendingRuntimeCanvasNodeDirtyIds.size
            ? Array.from(pendingRuntimeCanvasNodeDirtyIds)
            : undefined,
          orderChanged: runtimeCanvasNodeOrderChanged ? true : undefined
        }
      }
      if (docCanvasNodeFullSyncRequested) {
        return {
          fullSync: true
        }
      }
      return {
        dirtyNodeIds: pendingDocCanvasNodeDirtyIds.size
          ? Array.from(pendingDocCanvasNodeDirtyIds)
          : undefined,
        orderChanged: docCanvasNodeOrderChanged ? true : undefined
      }
    })()
    DERIVED_STATE_KEYS.forEach((key) => {
      const changed = !Object.is(nextSnapshot[key], derivedSnapshot[key])
      if (!changed) return
      if (key === 'canvasNodes') {
        canvasNodesChanged = true
        if (canvasNodeChangeListeners.size) {
          canvasNodeChangeListeners.forEach((listener) => {
            listener(canvasPayload)
          })
        }
      }
      const listeners = derivedListeners.get(key)
      if (!listeners?.size) return
      listeners.forEach((listener) => listener())
    })
    if (source === 'nodeOverrides') {
      pendingRuntimeCanvasNodeDirtyIds.clear()
      runtimeCanvasNodeOrderChanged = false
    } else {
      pendingDocCanvasNodeDirtyIds.clear()
      docCanvasNodeOrderChanged = false
      docCanvasNodeFullSyncRequested = false
    }
    derivedSnapshot = nextSnapshot
  }

  store.watch('nodeOverrides', () => emitDerivedChanges('nodeOverrides'))

  const watchState: State['watch'] = (key, listener) => {
    if (isDerivedStateKey(key)) {
      const listeners = derivedListeners.get(key) ?? new Set()
      listeners.add(listener)
      derivedListeners.set(key, listeners)
      return () => {
        const current = derivedListeners.get(key)
        if (!current) return
        current.delete(listener)
      }
    }
    return store.watch(key as NativeStateKey, listener)
  }

  const watchCanvasNodeChanges: State['watchCanvasNodeChanges'] = (listener) => {
    canvasNodeChangeListeners.add(listener)
    return () => {
      canvasNodeChangeListeners.delete(listener)
    }
  }

  const reportCanvasNodeDirty: State['reportCanvasNodeDirty'] = (
    nodeIds,
    source = 'runtime'
  ) => {
    if (source === 'doc') {
      nodeIds.forEach((nodeId) => {
        pendingDocCanvasNodeDirtyIds.add(nodeId)
      })
      return
    }
    nodeIds.forEach((nodeId) => {
      pendingRuntimeCanvasNodeDirtyIds.add(nodeId)
    })
  }

  const reportCanvasNodeOrderChanged: State['reportCanvasNodeOrderChanged'] = (
    source = 'runtime'
  ) => {
    if (source === 'doc') {
      docCanvasNodeOrderChanged = true
      return
    }
    runtimeCanvasNodeOrderChanged = true
  }

  const requestCanvasNodeFullSync: State['requestCanvasNodeFullSync'] = () => {
    docCanvasNodeFullSyncRequested = true
    pendingDocCanvasNodeDirtyIds.clear()
  }

  const readCanvasNodeById: State['readCanvasNodeById'] = (nodeId) =>
    graphCache.getCanvasNodeById(currentDoc, store.get('nodeOverrides'), nodeId)

  const setWritableState = <K extends WritableStateKey>(
    key: K,
    next:
      | WritableStateSnapshot[K]
      | ((prev: WritableStateSnapshot[K]) => WritableStateSnapshot[K])
  ) => {
    store.set(key, next)
  }

  const writeState: State['write'] = (key, next) => {
    setWritableState(key, next)
  }

  const batchState: State['batch'] = (action) => {
    store.batch(action)
  }

  const batchFrameState: State['batchFrame'] = (action) => {
    store.batchFrame(action)
  }

  const getStateSnapshot = (): StateSnapshot =>
    Object.fromEntries(STATE_KEYS.map((key) => [key, readState(key)])) as StateSnapshot

  const setDoc: State['setDoc'] = (doc) => {
    if (currentDoc === doc) return
    currentDoc = doc
    emitDerivedChanges('doc')
  }

  const state: State = {
    store,
    setDoc,
    read: readState,
    readCanvasNodeById,
    write: writeState,
    batch: batchState,
    batchFrame: batchFrameState,
    watch: watchState,
    watchCanvasNodeChanges,
    reportCanvasNodeDirty,
    reportCanvasNodeOrderChanged,
    requestCanvasNodeFullSync,
    snapshot: getStateSnapshot
  }

  return {
    state,
    readState,
    writeState
  }
}
