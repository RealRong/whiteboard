import type { Deps as ReadDeps } from '@engine-types/read/deps'
import type { Query } from '@engine-types/instance/query'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type ReadSubscriptionKey,
  type EngineRead
} from '@engine-types/instance/read'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type { ReadContext } from '@engine-types/read/context'
import type { Atom } from 'jotai/vanilla'
import { snapshot } from './stages/snapshot'
import { edge } from './stages/edge/stage'
import { node } from './stages/node'
import { mindmap } from './stages/mindmap/stage'
import { indexer } from './stages/index/stage'

export type ReadPort = {
  query: Query
  read: EngineRead
  applyInvalidation: (invalidation: ReadInvalidation) => void
}

export const createReadKernel = ({
  store,
  stateAtoms,
  config,
  viewport
}: ReadDeps): ReadPort => {
  const snapshotAtom = snapshot({
    documentAtom: stateAtoms.document,
    revisionAtom: stateAtoms.readModelRevision
  })
  const readDoc = () => store.get(stateAtoms.document)
  const readSnapshot = () => store.get(snapshotAtom)
  const indexes = indexer(config, readSnapshot)

  const state: ReadContext['state'] = {
    interaction: () => store.get(stateAtoms.interaction),
    tool: () => store.get(stateAtoms.tool),
    selection: () => store.get(stateAtoms.selection),
    viewport: () => store.get(stateAtoms.viewport),
    mindmapLayout: () => store.get(stateAtoms.mindmapLayout)
  }
  const subscribableAtomMap = {
    [READ_STATE_KEYS.interaction]: stateAtoms.interaction,
    [READ_STATE_KEYS.tool]: stateAtoms.tool,
    [READ_STATE_KEYS.selection]: stateAtoms.selection,
    [READ_STATE_KEYS.viewport]: stateAtoms.viewport,
    [READ_STATE_KEYS.mindmapLayout]: stateAtoms.mindmapLayout,
    [READ_SUBSCRIPTION_KEYS.snapshot]: snapshotAtom
  } as Record<ReadSubscriptionKey, Atom<unknown>>
  const subscribe: ReadContext['subscribe'] = (keys, listener) => {
    const unsubs = keys.map((key) =>
      store.sub(subscribableAtomMap[key], listener)
    )
    return () => unsubs.forEach(off => off())
  }
  const readContext: ReadContext = {
    state,
    snapshot: readSnapshot,
    subscribe,
    indexes: indexes.query,
    config
  }

  const edgeStage = edge(readContext)
  const nodeStage = node(readContext)
  const mindmapStage = mindmap(readContext)

  const query: Query = {
    viewport,
    canvas: {
      nodeRects: indexes.query.canvas.all,
      nodeRect: indexes.query.canvas.byId,
      nodeIdsInRect: indexes.query.canvas.idsInRect
    },
    snap: {
      candidates: indexes.query.snap.all,
      candidatesInRect: indexes.query.snap.inRect
    }
  }

  const read: EngineRead = {
    state: {
      get interaction() { return state.interaction() },
      get tool() { return state.tool() },
      get selection() { return state.selection() },
      get viewport() { return state.viewport() },
      get mindmapLayout() { return state.mindmapLayout() }
    },
    projection: {
      get viewportTransform() { return nodeStage.get.viewportTransform() },
      get node() { return nodeStage.get.node() },
      get edge() { return edgeStage.get.edge() },
      get mindmap() { return mindmapStage.get.mindmap() }
    },
    config: readContext.config,
    doc: {
      get: readDoc
    },
    subscribe
  }

  const applyInvalidation = (invalidation: ReadInvalidation) => {
    indexes.applyPlan(invalidation.index)
    edgeStage.applyPlan(invalidation.edge)
  }

  return {
    query,
    read,
    applyInvalidation
  }
}
