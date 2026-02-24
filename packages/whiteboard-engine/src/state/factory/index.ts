import type { Document, Viewport } from '@whiteboard/core/types'
import type {
  StateKey,
  State,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import { ProjectionStore } from '../../runtime/projection/Store'
import { WritableStore } from '../store'
import { createInitialState } from '../initialState'

type Result = {
  state: State
  projection: ProjectionStore
  syncDocument: () => void
}

type Options = {
  getDoc: () => Document | null
  readViewport: () => Viewport
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

export const createState = ({ getDoc, readViewport }: Options): Result => {
  const store = new WritableStore<WritableStateSnapshot>(
    createInitialState()
  )

  const projection = new ProjectionStore(getDoc)

  const viewportListeners = new Set<() => void>()
  const changeListeners = new Set<(key: StateKey) => void>()
  let viewportSnapshot = cloneViewport(readViewport())

  const readState = ((key) => {
    if (key === 'viewport') {
      return readViewport()
    }
    return store.get(key as WritableStateKey)
  }) as State['read']

  const syncViewport = () => {
    const nextViewport = readViewport()
    if (isSameViewport(nextViewport, viewportSnapshot)) return
    viewportSnapshot = cloneViewport(nextViewport)
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

  store.watchChanges((key) => {
    notifyChange(key as StateKey)
  })

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
    store.set(key, next as never)
  }

  const batchState: State['batch'] = (action) => {
    store.batch(action)
  }

  const batchFrameState: State['batchFrame'] = (action) => {
    store.batchFrame(action)
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
    projection,
    syncDocument: syncDocDerived
  }
}
