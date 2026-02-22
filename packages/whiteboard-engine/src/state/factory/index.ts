import type { Document, Viewport } from '@whiteboard/core/types'
import type {
  StateKey,
  State,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'
import { GraphProjector } from '../../runtime/actors/graph/projector/GraphProjector'
import { WritableStore } from '../store'
import { createInitialState } from '../initialState'

type Result = {
  state: State
  graph: GraphProjector
  replaceDoc: (doc: Document | null) => void
}

type Options = {
  doc?: Document | null
}

const toViewport = (
  doc: Document | null,
  previous?: Viewport
): Viewport => {
  const source = doc?.viewport
  const nextCenterX = source?.center?.x ?? DEFAULT_DOCUMENT_VIEWPORT.center.x
  const nextCenterY = source?.center?.y ?? DEFAULT_DOCUMENT_VIEWPORT.center.y
  const nextZoom = source?.zoom ?? DEFAULT_DOCUMENT_VIEWPORT.zoom

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
    createInitialState()
  )
  let currentDoc = doc

  const graph = new GraphProjector(() => currentDoc)

  const viewportListeners = new Set<() => void>()
  const changeListeners = new Set<(key: StateKey) => void>()
  const pendingChangeKeys = new Set<StateKey>()
  let writeBatchDepth = 0
  let writeFrameBatchDepth = 0
  let writeFrameFlushScheduled = false
  let viewportSnapshot = toViewport(currentDoc)

  const readState = ((key) => {
    if (key === 'viewport') {
      return viewportSnapshot
    }
    return store.get(key as WritableStateKey)
  }) as State['read']

  const syncViewport = () => {
    const nextViewport = toViewport(currentDoc, viewportSnapshot)
    if (Object.is(nextViewport, viewportSnapshot)) return
    viewportSnapshot = nextViewport
    if (!viewportListeners.size) return
    viewportListeners.forEach((listener) => listener())
    notifyChange('viewport')
  }

  const syncDocDerived = () => {
    syncViewport()
  }

  const notifyChange = (key: StateKey) => {
    if (!changeListeners.size) return
    changeListeners.forEach((listener) => {
      listener(key)
    })
  }

  const flushChangeKeys = () => {
    if (!pendingChangeKeys.size) return
    const keys = Array.from(pendingChangeKeys)
    pendingChangeKeys.clear()
    keys.forEach((key) => {
      notifyChange(key)
    })
  }

  const scheduleWriteFrameFlush = () => {
    if (writeFrameFlushScheduled || !pendingChangeKeys.size) return
    writeFrameFlushScheduled = true
    const runtime = globalThis as {
      requestAnimationFrame?: (task: () => void) => number
    }
    if (typeof runtime.requestAnimationFrame === 'function') {
      runtime.requestAnimationFrame(() => {
        writeFrameFlushScheduled = false
        flushChangeKeys()
      })
      return
    }
    setTimeout(() => {
      writeFrameFlushScheduled = false
      flushChangeKeys()
    }, 16)
  }

  const trackChange = (key: StateKey) => {
    if (writeBatchDepth > 0 || writeFrameBatchDepth > 0) {
      pendingChangeKeys.add(key)
      if (writeBatchDepth === 0) {
        scheduleWriteFrameFlush()
      }
      return
    }
    notifyChange(key)
  }

  const watchState: State['watch'] = (key, listener) => {
    if (key === 'viewport') {
      viewportListeners.add(listener)
      return () => {
        viewportListeners.delete(listener)
      }
    }
    return store.watch(key as WritableStateKey, listener)
  }

  const writeState: State['write'] = (key, next) => {
    const previous = store.get(key)
    const resolved =
      typeof next === 'function'
        ? (next as (value: WritableStateSnapshot[typeof key]) => WritableStateSnapshot[typeof key])(previous)
        : next
    if (Object.is(previous, resolved)) return
    store.set(key, resolved as never)
    trackChange(key)
  }

  const batchState: State['batch'] = (action) => {
    writeBatchDepth += 1
    try {
      store.batch(action)
    } finally {
      writeBatchDepth -= 1
      if (writeBatchDepth === 0) {
        if (writeFrameBatchDepth > 0) {
          scheduleWriteFrameFlush()
          return
        }
        flushChangeKeys()
      }
    }
  }

  const batchFrameState: State['batchFrame'] = (action) => {
    writeFrameBatchDepth += 1
    try {
      batchState(action)
    } finally {
      writeFrameBatchDepth -= 1
      if (writeBatchDepth === 0 && writeFrameBatchDepth === 0) {
        scheduleWriteFrameFlush()
      }
    }
  }

  const replaceDoc = (doc: Document | null) => {
    if (currentDoc === doc) return
    currentDoc = doc
    syncDocDerived()
  }

  const state: State = {
    read: readState,
    write: writeState,
    batch: batchState,
    batchFrame: batchFrameState,
    watchChanges: (listener) => {
      changeListeners.add(listener)
      return () => {
        changeListeners.delete(listener)
      }
    },
    watch: watchState
  }

  return {
    state,
    graph,
    replaceDoc
  }
}
