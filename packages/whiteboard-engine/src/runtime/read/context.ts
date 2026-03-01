import { atom, type Atom, type PrimitiveAtom, type createStore } from 'jotai/vanilla'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { QueryCanvas } from '@engine-types/instance/query'
import type {
  ReadPublicKey,
  ReadPublicValueMap
} from '@engine-types/instance/read'
import type { StateAtoms } from '../../state/factory/CreateState'
import type { ReadAtoms } from './atoms'

export type ReadInternalSignalKey = 'signal.edgeRevision'

export type ReadInternalKey = ReadPublicKey | ReadInternalSignalKey

export type ReadKeyValueMap = ReadPublicValueMap & { 'signal.edgeRevision': number }

export type ReadSubscribableInternalKey = ReadPublicKey | ReadInternalSignalKey

type ReadContextOptions = {
  runtimeStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  readAtoms: ReadAtoms
  config: InstanceConfig
  query: {
    nodeRect: QueryCanvas['nodeRect']
  }
}

type ReadAtomMap = {
  interaction: StateAtoms['interaction']
  tool: StateAtoms['tool']
  selection: StateAtoms['selection']
  viewport: StateAtoms['viewport']
  mindmapLayout: StateAtoms['mindmapLayout']
  snapshot: ReadAtoms['snapshot']
  'signal.edgeRevision': PrimitiveAtom<number>
}

type ReadSignalAtomMap = {
  [K in ReadInternalSignalKey]: PrimitiveAtom<ReadKeyValueMap[K]>
}

export type ReadRuntimeContext = {
  get: <K extends ReadInternalKey>(key: K) => ReadKeyValueMap[K]
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
  atom: <K extends ReadInternalKey>(key: K) => ReadAtomMap[K]
  readAtom: <T>(targetAtom: Atom<T>) => T
  query: {
    nodeRect: QueryCanvas['nodeRect']
  }
  config: InstanceConfig
  store: ReturnType<typeof createStore>
}

export const context = ({
  runtimeStore,
  stateAtoms,
  readAtoms,
  config,
  query
}: ReadContextOptions): ReadRuntimeContext => {
  const edgeRevisionAtom = atom(0)
  const keyAtomMap: ReadAtomMap = {
    interaction: stateAtoms.interaction,
    tool: stateAtoms.tool,
    selection: stateAtoms.selection,
    viewport: stateAtoms.viewport,
    mindmapLayout: stateAtoms.mindmapLayout,
    snapshot: readAtoms.snapshot,
    'signal.edgeRevision': edgeRevisionAtom
  }
  const signalAtomMap: ReadSignalAtomMap = {
    'signal.edgeRevision': edgeRevisionAtom
  }
  const get = <K extends ReadInternalKey>(key: K): ReadKeyValueMap[K] =>
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

  const getAtom = <K extends ReadInternalKey>(key: K): ReadAtomMap[K] =>
    keyAtomMap[key]

  return {
    get,
    subscribe,
    setSignal,
    atom: getAtom,
    readAtom: (targetAtom) => runtimeStore.get(targetAtom),
    query: {
      nodeRect: query.nodeRect
    },
    config,
    store: runtimeStore
  }
}
