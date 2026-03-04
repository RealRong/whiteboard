import type { Atom } from 'jotai/vanilla'
import type { Deps as ReadDeps } from '@engine-types/read/deps'
import type { Query } from '@engine-types/instance/query'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type EngineRead
} from '@engine-types/instance/read'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type {
  ReadContextKey,
  ReadKeyValueMap,
  ReadRuntimeContext,
  ReadSubscribableInternalKey
} from '@engine-types/read/context'
import { query } from './api/query'
import { readApi } from './api/read'
import { edge } from './stages/edge/stage'
import { node } from './stages/node'
import { mindmap } from './stages/mindmap/stage'
import { indexer } from './stages/index/stage'

export type ReadRuntimePort = {
  query: Query
  read: EngineRead
  applyInvalidation: (invalidation: ReadInvalidation) => void
}

export const createReadKernel = ({
  runtimeStore,
  stateAtoms,
  snapshotAtom,
  config,
  readDoc,
  viewport
}: ReadDeps): ReadRuntimePort => {
  const readSnapshot = () => runtimeStore.get(snapshotAtom)
  const indexes = indexer(config, readSnapshot)
  const queryApi = query({
    readDoc,
    viewport,
    config,
    indexes
  })

  const keyAtomMap = {
    [READ_STATE_KEYS.interaction]: stateAtoms.interaction,
    [READ_STATE_KEYS.tool]: stateAtoms.tool,
    [READ_STATE_KEYS.selection]: stateAtoms.selection,
    [READ_STATE_KEYS.viewport]: stateAtoms.viewport,
    [READ_STATE_KEYS.mindmapLayout]: stateAtoms.mindmapLayout,
    [READ_SUBSCRIPTION_KEYS.snapshot]: snapshotAtom
  }
  const get = <K extends ReadContextKey>(key: K): ReadKeyValueMap[K] =>
    runtimeStore.get(keyAtomMap[key] as Atom<ReadKeyValueMap[K]>)
  const subscribe: ReadRuntimeContext['subscribe'] = (keys, listener) => {
    const unsubs = keys.map((key: ReadSubscribableInternalKey) =>
      runtimeStore.sub(keyAtomMap[key] as Atom<unknown>, listener)
    )
    return () => {
      unsubs.forEach((off) => {
        off()
      })
    }
  }
  const readContext: ReadRuntimeContext = {
    get,
    subscribe,
    query: queryApi,
    config
  }

  const edgeStage = edge(readContext)
  const nodeStage = node(readContext)
  const mindmapStage = mindmap(readContext)

  const read = readApi({
    context: readContext,
    node: nodeStage,
    edge: edgeStage,
    mindmap: mindmapStage
  })

  const applyInvalidation = (invalidation: ReadInvalidation) => {
    indexes.applyPlan(invalidation.index)
    edgeStage.applyPlan(invalidation.edge)
  }

  return {
    query: queryApi,
    read,
    applyInvalidation
  }
}
