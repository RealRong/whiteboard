import type { Document, Viewport } from '@whiteboard/core'
import type { GraphProjector } from '@engine-types/graph'
import type {
  State,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'
import { createGraphProjector } from '../../graph'
import { WritableStore } from '../../kernel/state'
import { createWritableStateSnapshot } from '../writable'

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
    createWritableStateSnapshot()
  )
  let currentDoc = doc

  const graph = createGraphProjector({
    getDoc: () => currentDoc
  })

  const viewportListeners = new Set<() => void>()
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
  }

  const syncDocDerived = () => {
    syncViewport()
    graph.flush('doc')
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

  const writeState: State['write'] = (key, next) => store.set(key, next as never)
  const batchState: State['batch'] = (action) => store.batch(action)
  const batchFrameState: State['batchFrame'] = (action) => store.batchFrame(action)

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
    watch: watchState
  }

  return {
    state,
    graph,
    replaceDoc
  }
}
