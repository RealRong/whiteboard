import type { Deps as ReadDeps } from '@engine-types/read/deps'
import type { Query } from '@engine-types/instance/query'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type ReadSubscriptionKey,
  type EngineRead
} from '@engine-types/instance/read'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type {
  ReadRuntimeContext
} from '@engine-types/read/context'
import type { Atom } from 'jotai/vanilla'
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

  const state: ReadRuntimeContext['state'] = {
    interaction: () => runtimeStore.get(stateAtoms.interaction),
    tool: () => runtimeStore.get(stateAtoms.tool),
    selection: () => runtimeStore.get(stateAtoms.selection),
    viewport: () => runtimeStore.get(stateAtoms.viewport),
    mindmapLayout: () => runtimeStore.get(stateAtoms.mindmapLayout)
  }
  const subscribableAtomMap: Record<ReadSubscriptionKey, Atom<unknown>> = {
    [READ_STATE_KEYS.interaction]: stateAtoms.interaction as Atom<unknown>,
    [READ_STATE_KEYS.tool]: stateAtoms.tool as Atom<unknown>,
    [READ_STATE_KEYS.selection]: stateAtoms.selection as Atom<unknown>,
    [READ_STATE_KEYS.viewport]: stateAtoms.viewport as Atom<unknown>,
    [READ_STATE_KEYS.mindmapLayout]: stateAtoms.mindmapLayout as Atom<unknown>,
    [READ_SUBSCRIPTION_KEYS.snapshot]: snapshotAtom as Atom<unknown>
  }
  const subscribe: ReadRuntimeContext['subscribe'] = (keys, listener) => {
    const unsubs = keys.map((key) =>
      runtimeStore.sub(subscribableAtomMap[key], listener)
    )
    return () => {
      unsubs.forEach((off) => {
        off()
      })
    }
  }
  const readContext: ReadRuntimeContext = {
    state,
    snapshot: readSnapshot,
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
