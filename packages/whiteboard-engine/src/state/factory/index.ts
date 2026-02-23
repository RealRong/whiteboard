import type { Document, Viewport } from '@whiteboard/core/types'
import type {
  StateKey,
  State,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'
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

export const createState = ({ getDoc }: Options): Result => {
  const store = new WritableStore<WritableStateSnapshot>(
    createInitialState()
  )

  const projection = new ProjectionStore(getDoc)

  const viewportListeners = new Set<() => void>()
  const changeListeners = new Set<(key: StateKey) => void>()
  let viewportSnapshot = toViewport(getDoc())

  const readState = ((key) => {
    if (key === 'viewport') {
      return viewportSnapshot
    }
    return store.get(key as WritableStateKey)
  }) as State['read']

  const syncViewport = () => {
    const nextViewport = toViewport(getDoc(), viewportSnapshot)
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
