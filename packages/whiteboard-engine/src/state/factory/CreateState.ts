import type { Document, Viewport } from '@whiteboard/core/types'
import { atom, createStore, type PrimitiveAtom } from 'jotai/vanilla'
import type {
  State,
  StateSnapshot,
  StateKey,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { InteractionState, SelectionState } from '@engine-types/state'
import { ProjectionStore } from '../../runtime/projection/Store'
import { createInitialState } from '../initialState'

type Result = {
  state: State
  projection: ProjectionStore
  syncViewport: () => void
  stateStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
}

type Options = {
  getDoc: () => Document
  readViewport: () => Viewport
  store: ReturnType<typeof createStore>
}

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const isSameViewport = (left: Viewport, right: Viewport) =>
  left.zoom === right.zoom
  && left.center.x === right.center.x
  && left.center.y === right.center.y

type Listener = () => void
type ChangeListener = (key: StateKey) => void
type Updater<T> = T | ((prev: T) => T)

type WritableStateAtoms = {
  interaction: PrimitiveAtom<InteractionState>
  tool: PrimitiveAtom<'select' | 'edge'>
  selection: PrimitiveAtom<SelectionState>
  mindmapLayout: PrimitiveAtom<MindmapLayoutConfig>
}

export type StateAtoms = WritableStateAtoms & {
  viewport: PrimitiveAtom<Viewport>
}

type WritableStateAtomMap = {
  [K in WritableStateKey]: PrimitiveAtom<WritableStateSnapshot[K]>
}

const resolveNext = <T,>(next: Updater<T>, prev: T): T =>
  typeof next === 'function' ? (next as (value: T) => T)(prev) : next

export const createState = ({ getDoc, readViewport, store }: Options): Result => {
  const initialState = createInitialState()
  const stateStore = store
  const stateAtoms: StateAtoms = {
    interaction: atom(initialState.interaction),
    tool: atom(initialState.tool),
    selection: atom(initialState.selection),
    mindmapLayout: atom(initialState.mindmapLayout),
    viewport: atom(cloneViewport(readViewport()))
  }
  const writableStateAtoms: WritableStateAtomMap = {
    interaction: stateAtoms.interaction,
    tool: stateAtoms.tool,
    selection: stateAtoms.selection,
    mindmapLayout: stateAtoms.mindmapLayout
  }
  const projection = new ProjectionStore(getDoc)

  const keyListeners = new Map<StateKey, Set<Listener>>()
  const changeListeners = new Set<ChangeListener>()
  let batchDepth = 0
  let frameBatchDepth = 0
  let frameFlushScheduled = false
  const pendingKeys = new Set<StateKey>()
  let viewportSnapshot = stateStore.get(stateAtoms.viewport)

  const watchKey = (key: StateKey, listener: Listener) => {
    let listeners = keyListeners.get(key)
    if (!listeners) {
      listeners = new Set<Listener>()
      keyListeners.set(key, listeners)
    }
    listeners.add(listener)
    return () => {
      const next = keyListeners.get(key)
      if (!next) return
      next.delete(listener)
      if (!next.size) {
        keyListeners.delete(key)
      }
    }
  }

  const notifyChange = (key: StateKey) => {
    const listeners = keyListeners.get(key)
    if (listeners?.size) {
      listeners.forEach((listener) => listener())
    }
    if (!changeListeners.size) return
    changeListeners.forEach((listener) => {
      listener(key)
    })
  }

  const flush = () => {
    if (!pendingKeys.size) return
    const changedKeys = Array.from(pendingKeys)
    pendingKeys.clear()
    changedKeys.forEach((key) => notifyChange(key))
  }

  const scheduleFrameFlush = () => {
    if (frameFlushScheduled || !pendingKeys.size) return
    frameFlushScheduled = true
    const requestFrame = (
      globalThis as { requestAnimationFrame?: (callback: () => void) => number }
    ).requestAnimationFrame
    if (typeof requestFrame === 'function') {
      requestFrame(() => {
        frameFlushScheduled = false
        flush()
      })
      return
    }
    setTimeout(() => {
      frameFlushScheduled = false
      flush()
    }, 16)
  }

  const enqueueChange = (key: StateKey) => {
    if (batchDepth > 0 || frameBatchDepth > 0) {
      pendingKeys.add(key)
      if (batchDepth === 0) {
        scheduleFrameFlush()
      }
      return
    }
    notifyChange(key)
  }

  const syncViewport = () => {
    const nextViewport = readViewport()
    if (isSameViewport(nextViewport, viewportSnapshot)) return
    viewportSnapshot = cloneViewport(nextViewport)
    stateStore.set(stateAtoms.viewport, viewportSnapshot)
    enqueueChange('viewport')
  }

  const readWritable = <K extends WritableStateKey>(key: K): WritableStateSnapshot[K] => {
    return stateStore.get(writableStateAtoms[key])
  }

  const writeWritable = <K extends WritableStateKey>(
    key: K,
    next: Updater<WritableStateSnapshot[K]>
  ) => {
    const prev = readWritable(key)
    const resolved = resolveNext(next, prev)
    if (Object.is(prev, resolved)) return

    stateStore.set(writableStateAtoms[key], resolved)
    enqueueChange(key)
  }

  const readState = <K extends StateKey>(key: K): StateSnapshot[K] => {
    if (key === 'viewport') {
      return stateStore.get(stateAtoms.viewport) as StateSnapshot[K]
    }
    return readWritable(key as WritableStateKey) as StateSnapshot[K]
  }

  const writeState: State['write'] = (key, next) => {
    writeWritable(key, next)
  }

  const state: State = {
    read: readState,
    write: writeState,
    batch: (action) => {
      batchDepth += 1
      try {
        action()
      } finally {
        batchDepth -= 1
        if (batchDepth === 0) {
          if (frameBatchDepth > 0) {
            scheduleFrameFlush()
          } else {
            flush()
          }
        }
      }
    },
    batchFrame: (action) => {
      frameBatchDepth += 1
      try {
        state.batch(action)
      } finally {
        frameBatchDepth -= 1
        if (batchDepth === 0 && frameBatchDepth === 0) {
          scheduleFrameFlush()
        }
      }
    },
    watchChanges: (listener) => {
      changeListeners.add(listener)
      return () => {
        changeListeners.delete(listener)
      }
    },
    watch: watchKey
  }

  return {
    state,
    projection,
    syncViewport,
    stateStore,
    stateAtoms
  }
}
