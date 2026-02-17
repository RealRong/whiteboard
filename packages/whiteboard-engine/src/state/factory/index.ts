import type { Document } from '@whiteboard/core'
import type { Viewport } from '@whiteboard/core'
import type {
  State,
  StateKey,
  StateSnapshot,
  WritableStateSnapshot
} from '@engine-types/instance'
import { WritableStore } from '../../kernel/state'
import { DERIVED_STATE_KEYS, STATE_KEYS } from '../keys'
import type { DerivedStateKey, NativeStateKey } from '../keys'
import { createWritableStateSnapshot } from '../writable'
import {
  createCanvasNodes,
  type CanvasNodes
} from '../../kernel/projector/canvas'

type Result = {
  state: State
  canvas: CanvasNodes
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
  const canvas = createCanvasNodes({
    getDoc: () => currentDoc,
    getNodeOverrides: () => store.get('nodeOverrides')
  })
  const derivedListeners = new Map<DerivedStateKey, Set<() => void>>(
    DERIVED_STATE_KEYS.map((key) => [key, new Set()])
  )
  const isDerivedStateKey = (key: StateKey): key is DerivedStateKey =>
    key === 'viewport' ||
    key === 'visibleNodes' ||
    key === 'canvasNodes' ||
    key === 'visibleEdges'

  const readDerivedSnapshot = (previous?: DerivedSnapshot): DerivedSnapshot => {
    const graphSnapshot = canvas.readSnapshot()

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
    DERIVED_STATE_KEYS.forEach((key) => {
      const changed = !Object.is(nextSnapshot[key], derivedSnapshot[key])
      if (!changed) return
      if (key === 'canvasNodes') {
        canvasNodesChanged = true
      }
      const listeners = derivedListeners.get(key)
      if (!listeners?.size) return
      listeners.forEach((listener) => listener())
    })
    canvas.flush(source, canvasNodesChanged)
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

  const writeState: State['write'] = (key, next) => store.set(key, next)
  const batchState: State['batch'] = (action) => store.batch(action)
  const batchFrameState: State['batchFrame'] = (action) => store.batchFrame(action)

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
    write: writeState,
    batch: batchState,
    batchFrame: batchFrameState,
    watch: watchState,
    snapshot: getStateSnapshot
  }

  return {
    state,
    canvas
  }
}
