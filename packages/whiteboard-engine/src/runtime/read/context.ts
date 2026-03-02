import { atom, type Atom, type PrimitiveAtom, type createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import {
  READ_PUBLIC_KEYS,
  READ_SUBSCRIBE_KEYS,
  type ReadInternalKey,
  type ReadInternalValueMap,
  type ReadSubscribeKey
} from '@engine-types/instance/read'
import type { StateAtoms } from '../../state/factory/CreateState'

export const READ_INTERNAL_SIGNAL_KEYS = {
  edgeRevision: 'signal.edgeRevision'
} as const

export type ReadInternalSignalKey =
  (typeof READ_INTERNAL_SIGNAL_KEYS)[keyof typeof READ_INTERNAL_SIGNAL_KEYS]

type ReadContextKey = ReadInternalKey | ReadInternalSignalKey

export type ReadKeyValueMap = ReadInternalValueMap & {
  [READ_INTERNAL_SIGNAL_KEYS.edgeRevision]: number
}

export type ReadSubscribableInternalKey = ReadSubscribeKey | ReadInternalSignalKey

type ReadContextOptions = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  snapshotAtom: Atom<ReadModelSnapshot>
  config: InstanceConfig
  query: Query
}

type ReadAtomMap = {
  [READ_PUBLIC_KEYS.interaction]: StateAtoms['interaction']
  [READ_PUBLIC_KEYS.tool]: StateAtoms['tool']
  [READ_PUBLIC_KEYS.selection]: StateAtoms['selection']
  [READ_PUBLIC_KEYS.viewport]: StateAtoms['viewport']
  [READ_PUBLIC_KEYS.mindmapLayout]: StateAtoms['mindmapLayout']
  [READ_SUBSCRIBE_KEYS.snapshot]: Atom<ReadModelSnapshot>
  [READ_INTERNAL_SIGNAL_KEYS.edgeRevision]: PrimitiveAtom<number>
}

type ReadSignalAtomMap = {
  [K in ReadInternalSignalKey]: PrimitiveAtom<ReadKeyValueMap[K]>
}

// Read layer composition should depend on this single context object
// instead of forwarding fragmented params between runtime/cache/atoms/projection modules.
export type ReadRuntimeContext = {
  get: <K extends ReadContextKey>(key: K) => ReadKeyValueMap[K]
  subscribe: (
    keys: readonly ReadSubscribableInternalKey[],
    listener: () => void
  ) => () => void
  setSignal: <K extends ReadInternalSignalKey>(
    key: K,
    updater:
      | ReadKeyValueMap[K]
      | ((prev: ReadKeyValueMap[K]) => ReadKeyValueMap[K])
  ) => void
  atom: <K extends ReadContextKey>(key: K) => ReadAtomMap[K]
  query: Query
  config: InstanceConfig
  store: ReturnType<typeof createStore>
}

export const context = ({
  runtimeStore,
  stateAtoms,
  snapshotAtom,
  config,
  query
}: ReadContextOptions): ReadRuntimeContext => {
  const edgeRevisionAtom = atom(0)
  const keyAtomMap: ReadAtomMap = {
    [READ_PUBLIC_KEYS.interaction]: stateAtoms.interaction,
    [READ_PUBLIC_KEYS.tool]: stateAtoms.tool,
    [READ_PUBLIC_KEYS.selection]: stateAtoms.selection,
    [READ_PUBLIC_KEYS.viewport]: stateAtoms.viewport,
    [READ_PUBLIC_KEYS.mindmapLayout]: stateAtoms.mindmapLayout,
    [READ_SUBSCRIBE_KEYS.snapshot]: snapshotAtom,
    [READ_INTERNAL_SIGNAL_KEYS.edgeRevision]: edgeRevisionAtom
  }
  const signalAtomMap: ReadSignalAtomMap = {
    [READ_INTERNAL_SIGNAL_KEYS.edgeRevision]: edgeRevisionAtom
  }
  const get = <K extends ReadContextKey>(key: K): ReadKeyValueMap[K] =>
    runtimeStore.get(keyAtomMap[key] as Atom<ReadKeyValueMap[K]>)

  const subscribe: ReadRuntimeContext['subscribe'] = (keys, listener) => {
    const unsubs = keys.map((key) =>
      runtimeStore.sub(keyAtomMap[key] as Atom<unknown>, listener)
    )
    return () => {
      unsubs.forEach((off) => {
        off()
      })
    }
  }

  const setSignal = <K extends ReadInternalSignalKey>(
    key: K,
    updater:
      | ReadKeyValueMap[K]
      | ((prev: ReadKeyValueMap[K]) => ReadKeyValueMap[K])
  ) => {
    runtimeStore.set(signalAtomMap[key], updater as ReadKeyValueMap[K])
  }

  const getAtom = <K extends ReadContextKey>(key: K): ReadAtomMap[K] =>
    keyAtomMap[key]

  return {
    get,
    subscribe,
    setSignal,
    atom: getAtom,
    query,
    config,
    store: runtimeStore
  }
}
