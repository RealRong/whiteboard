import type {
  ReadContext,
  ReadDeps,
  ReadImpact,
  ReadIndexes
} from '@engine-types/read'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type EngineRead,
  type ReadSubscriptionKey
} from '@engine-types/instance'
import { atom } from 'jotai/vanilla'
import type { Viewport } from '@whiteboard/core/types'
import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_TUNING } from '../config'
import { createReadApply } from './apply'
import { MINDMAP_LAYOUT_READ_IMPACT, RESET_READ_IMPACT } from './impacts'
import { createReadModel } from './model'
import {
  createEdgeProjection,
  createMindmapProjection,
  createNodeProjection
} from './projection'
import { NodeRectIndex } from './indexes'
import { SnapIndex } from './indexes'

export type ReadApi = {
  api: EngineRead
  invalidate: {
    impact: (impact: ReadImpact) => void
    reset: () => void
    mindmap: () => void
  }
}

type ProjectionSubscriptionKey = Exclude<
  ReadSubscriptionKey,
  typeof READ_STATE_KEYS.viewport
>

const createProjectionSubscriptions = () => {
  const listenersByKey: Record<ProjectionSubscriptionKey, Set<() => void>> = {
    [READ_SUBSCRIPTION_KEYS.node]: new Set(),
    [READ_SUBSCRIPTION_KEYS.edge]: new Set(),
    [READ_SUBSCRIPTION_KEYS.mindmap]: new Set()
  }

  const subscribe = (
    key: ProjectionSubscriptionKey,
    listener: () => void
  ) => {
    listenersByKey[key].add(listener)
    return () => {
      listenersByKey[key].delete(listener)
    }
  }

  const publish = (keys: readonly ProjectionSubscriptionKey[]) => {
    const listeners = new Set<() => void>()

    keys.forEach((key) => {
      listenersByKey[key].forEach((listener) => {
        listeners.add(listener)
      })
    })

    listeners.forEach((listener) => {
      listener()
    })
  }

  return {
    subscribe,
    publish
  }
}

export const createRead = ({
  store,
  documentAtom,
  getMindmapLayout,
  config
}: ReadDeps): ReadApi => {
  const viewportAtom = atom<Viewport>((get) => (
    get(documentAtom).viewport ?? DEFAULT_DOCUMENT_VIEWPORT
  ))
  const readDocument = () => store.get(documentAtom)
  const readViewport = () => store.get(viewportAtom)
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

  const projectionSubscriptions = createProjectionSubscriptions()

  const subscribe: EngineRead['subscribe'] = (keys, listener) => {
    const normalizedKeys = Array.from(new Set(keys))
    const offs = normalizedKeys.map((key) => {
      if (key === READ_STATE_KEYS.viewport) {
        return store.sub(viewportAtom, listener)
      }
      return projectionSubscriptions.subscribe(key, listener)
    })

    return () => offs.forEach((off) => off())
  }

  const readContext: ReadContext = {
    mindmapLayout: getMindmapLayout,
    model: readModel,
    indexes,
    config
  }

  const nodeProjection = createNodeProjection(readContext)
  const edgeProjection = createEdgeProjection(readContext)
  const mindmapProjection = createMindmapProjection(readContext)

  const applyImpact = createReadApply({
    readModel,
    nodeRectIndex,
    snapIndex,
    edgeProjection,
    publish: projectionSubscriptions.publish
  })

  nodeRectIndex.applyChange('full', [], readModel())
  snapIndex.applyChange('full', [], nodeRectIndex)

  return {
    api: {
      state: {
        get viewport() { return readViewport() }
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
    },
    invalidate: {
      impact: applyImpact,
      reset: () => applyImpact(RESET_READ_IMPACT),
      mindmap: () => applyImpact(MINDMAP_LAYOUT_READ_IMPACT)
    }
  }
}
