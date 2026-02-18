import type { Document, Viewport } from '@whiteboard/core'
import type { GraphProjector } from '@engine-types/graph'
import type {
  State,
  StateKey,
  StateSnapshot,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'
import { createGraphProjector } from '../../graph'
import { WritableStore } from '../../kernel/state'
import { DERIVED_STATE_KEYS } from '../keys'
import type { DerivedStateKey, NativeStateKey } from '../keys'
import { createWritableStateSnapshot } from '../writable'

type Result = {
  state: State
  graph: GraphProjector
  replaceDoc: (doc: Document | null) => void
}

type Options = {
  doc?: Document | null
}

type DerivedSnapshot = Pick<StateSnapshot, DerivedStateKey>

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

  const derivedListeners = new Map<DerivedStateKey, Set<() => void>>(
    DERIVED_STATE_KEYS.map((key) => [key, new Set()])
  )
  const isDerivedStateKey = (key: StateKey): key is DerivedStateKey =>
    key === 'viewport'

  const readDerivedSnapshot = (previous?: DerivedSnapshot): DerivedSnapshot => {
    return {
      viewport: toViewport(currentDoc, previous?.viewport)
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

  const emitDerivedChanges = () => {
    const nextSnapshot = readDerivedSnapshot(derivedSnapshot)
    DERIVED_STATE_KEYS.forEach((key) => {
      const changed = !Object.is(nextSnapshot[key], derivedSnapshot[key])
      if (!changed) return
      const listeners = derivedListeners.get(key)
      if (!listeners?.size) return
      listeners.forEach((listener) => listener())
    })

    graph.flush('doc')
    derivedSnapshot = nextSnapshot
  }

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

  const writeState: State['write'] = (key, next) => store.set(key as NativeStateKey, next as never)
  const batchState: State['batch'] = (action) => store.batch(action)
  const batchFrameState: State['batchFrame'] = (action) => store.batchFrame(action)

  const replaceDoc = (doc: Document | null) => {
    if (currentDoc === doc) return
    currentDoc = doc
    emitDerivedChanges()
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
