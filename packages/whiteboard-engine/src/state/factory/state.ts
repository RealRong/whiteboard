import type { Document, Viewport } from '@whiteboard/core/types'
import { atom, createStore, type PrimitiveAtom } from 'jotai/vanilla'
import type {
  State,
  StateSnapshot,
  StateKey,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import type { InteractionState, SelectionState } from '@engine-types/state/model'
import type { Atoms as StateAtoms } from '@engine-types/state/factory'
import { createInitialState } from '../initialState'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'

type Result = {
  state: State
  stateAtoms: StateAtoms
}

type Options = {
  getDoc: () => Document
  store: ReturnType<typeof createStore>
}

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

type Updater<T> = T | ((prev: T) => T)

type WritableStateAtoms = {
  interaction: PrimitiveAtom<InteractionState>
  tool: PrimitiveAtom<'select' | 'edge'>
  selection: PrimitiveAtom<SelectionState>
  mindmapLayout: PrimitiveAtom<MindmapLayoutConfig>
}

type WritableStateAtomMap = {
  [K in WritableStateKey]: PrimitiveAtom<WritableStateSnapshot[K]>
}

const resolveNext = <T,>(next: Updater<T>, prev: T): T =>
  typeof next === 'function' ? (next as (value: T) => T)(prev) : next

export const state = ({ getDoc, store }: Options): Result => {
  const initialDoc = getDoc()
  const initialState = createInitialState()
  const initialViewport = cloneViewport(initialDoc.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
  const stateAtoms: StateAtoms = {
    interaction: atom(initialState.interaction),
    tool: atom(initialState.tool),
    selection: atom(initialState.selection),
    mindmapLayout: atom(initialState.mindmapLayout),
    viewport: atom(initialViewport),
    document: atom(initialDoc),
    readModelRevision: atom(0)
  }
  const writableStateAtoms: WritableStateAtomMap = {
    interaction: stateAtoms.interaction,
    tool: stateAtoms.tool,
    selection: stateAtoms.selection,
    mindmapLayout: stateAtoms.mindmapLayout
  }

  const readWritable = <K extends WritableStateKey>(key: K): WritableStateSnapshot[K] => {
    return store.get(writableStateAtoms[key])
  }

  const writeWritable = <K extends WritableStateKey>(
    key: K,
    next: Updater<WritableStateSnapshot[K]>
  ) => {
    const prev = readWritable(key)
    const resolved = resolveNext(next, prev)
    if (Object.is(prev, resolved)) return

    store.set(writableStateAtoms[key], resolved)
  }

  const readState = <K extends StateKey>(key: K): StateSnapshot[K] => {
    if (key === 'viewport') {
      return store.get(stateAtoms.viewport) as StateSnapshot[K]
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
      action()
    }
  }

  return {
    state,
    stateAtoms
  }
}
