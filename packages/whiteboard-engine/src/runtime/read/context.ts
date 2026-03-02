import type { Atom } from 'jotai/vanilla'
import type { Query } from '@engine-types/instance/query'
import type { Deps as ReadDeps } from '@engine-types/read/deps'
import {
  READ_PUBLIC_KEYS,
  READ_SUBSCRIBE_KEYS
} from '@engine-types/instance/read'
import type {
  ReadContextKey,
  ReadKeyValueMap,
  ReadRuntimeContext,
  ReadSubscribableInternalKey
} from '@engine-types/read/context'

type ContextDeps = Pick<
  ReadDeps,
  'runtimeStore' | 'stateAtoms' | 'snapshotAtom' | 'config'
> & {
  query: Query
}

export const context = ({
  runtimeStore,
  stateAtoms,
  snapshotAtom,
  config,
  query
}: ContextDeps): ReadRuntimeContext => {
  const keyAtomMap = {
    [READ_PUBLIC_KEYS.interaction]: stateAtoms.interaction,
    [READ_PUBLIC_KEYS.tool]: stateAtoms.tool,
    [READ_PUBLIC_KEYS.selection]: stateAtoms.selection,
    [READ_PUBLIC_KEYS.viewport]: stateAtoms.viewport,
    [READ_PUBLIC_KEYS.mindmapLayout]: stateAtoms.mindmapLayout,
    [READ_SUBSCRIBE_KEYS.snapshot]: snapshotAtom
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

  return {
    get,
    subscribe,
    query,
    config
  }
}
