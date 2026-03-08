import type { Deps as ReadDeps } from '@engine-types/read/deps'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type EngineRead,
  type ReadSubscriptionKey
} from '@engine-types/instance/read'
import type { ReadContext } from '@engine-types/read/context'
import type { ReadImpact } from '@engine-types/read/control/impact'
import type { ReadIndexes } from '@engine-types/read/indexes/indexer'
import type { Atom } from 'jotai/vanilla'
import { atom } from 'jotai/vanilla'
import { DEFAULT_TUNING } from '../../config'
import { createReadApply } from './apply'
import { createReadSignals } from './signals'
import { createReadModel } from './stages/model'
import { projection as createNodeProjection } from './stages/node/projection'
import { projection as createEdgeProjection } from './stages/edge/projection'
import { projection as createMindmapProjection } from './stages/mindmap/projection'
import { NodeRectIndex } from './stages/index/NodeRectIndex'
import { SnapIndex } from './stages/index/SnapIndex'

export type ReadRuntime = {
  api: EngineRead
  applyImpact: (impact: ReadImpact) => void
}

export const createReadRuntime = ({
  store,
  stateAtoms,
  config
}: ReadDeps): ReadRuntime => {
  const nodeSignalAtom = atom(0)
  const edgeSignalAtom = atom(0)
  const mindmapSignalAtom = atom(0)
  const readDocument = () => store.get(stateAtoms.document)
  const readModel = createReadModel({ readDocument })

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const indexes: ReadIndexes = {
    canvas: {
      all: nodeRectIndex.all,
      byId: nodeRectIndex.byId,
      idsInRect: nodeRectIndex.nodeIdsInRect
    },
    snap: {
      all: snapIndex.all,
      inRect: snapIndex.queryInRect
    }
  }

  const state: ReadContext['state'] = {
    viewport: () => store.get(stateAtoms.viewport),
    mindmapLayout: () => store.get(stateAtoms.mindmapLayout)
  }

  const subscribableAtomMap = {
    [READ_STATE_KEYS.viewport]: stateAtoms.viewport,
    [READ_STATE_KEYS.mindmapLayout]: stateAtoms.mindmapLayout,
    [READ_SUBSCRIPTION_KEYS.node]: nodeSignalAtom,
    [READ_SUBSCRIPTION_KEYS.edge]: edgeSignalAtom,
    [READ_SUBSCRIPTION_KEYS.mindmap]: mindmapSignalAtom
  } as Record<ReadSubscriptionKey, Atom<unknown>>

  const subscribe: ReadContext['subscribe'] = (keys, listener) => {
    const unsubs = keys.map((key) => store.sub(subscribableAtomMap[key], listener))
    return () => unsubs.forEach((off) => off())
  }

  const readContext: ReadContext = {
    state,
    model: readModel,
    subscribe,
    indexes,
    config
  }

  const nodeProjection = createNodeProjection(readContext)
  const edgeProjection = createEdgeProjection(readContext)
  const mindmapProjection = createMindmapProjection(readContext)

  const signals = createReadSignals({
    store,
    atoms: {
      node: nodeSignalAtom,
      edge: edgeSignalAtom,
      mindmap: mindmapSignalAtom
    }
  })

  const apply = createReadApply({
    readModel,
    nodeRectIndex,
    snapIndex,
    edgeProjection,
    applySignals: signals.apply
  })

  nodeRectIndex.applyChange('full', [], readModel())
  snapIndex.applyChange('full', [], nodeRectIndex)

  const api: EngineRead = {
    state: {
      get viewport() { return state.viewport() },
      get mindmapLayout() { return state.mindmapLayout() }
    },
    projection: {
      get node() { return nodeProjection.getView() },
      get edge() { return edgeProjection.getView() },
      get mindmap() { return mindmapProjection.getView() }
    },
    index: {
      nodeRects: indexes.canvas.all,
      nodeRect: indexes.canvas.byId,
      nodeIdsInRect: indexes.canvas.idsInRect,
      snapCandidates: indexes.snap.all,
      snapCandidatesInRect: indexes.snap.inRect
    },
    config,
    get document() { return readDocument() },
    subscribe
  }

  const applyImpact = (impact: ReadImpact) => {
    apply(impact)
  }

  return {
    api,
    applyImpact
  }
}
