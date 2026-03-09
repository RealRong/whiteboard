import type {
  ProjectionSubscriptionKey,
  ReadControl,
  ReadContext,
  ReadDeps,
  ReadIndexes
} from '@engine-types/read'
import {
  READ_KEYS,
  type EngineRead
} from '@engine-types/instance'
import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_TUNING } from '../config'
import { createReadApply } from './apply'
import { MINDMAP_LAYOUT_READ_IMPACT, RESET_READ_IMPACT } from './impacts'
import { createReadModel } from './model'
import {
  createEdgeProjection,
  createMindmapProjection,
  createNodeProjection
} from './projection'
import { NodeRectIndex, SnapIndex } from './indexes'

const subscribeListener = (
  listeners: Set<() => void>,
  listener: () => void
) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const createRead = ({
  document,
  mindmapLayout,
  config
}: ReadDeps): ReadControl => {
  const readDocument = document.get
  const readViewport = () => readDocument().viewport ?? DEFAULT_DOCUMENT_VIEWPORT
  const readModel = createReadModel({ readDocument })

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const indexes: ReadIndexes = {
    node: {
      all: nodeRectIndex.all,
      byId: nodeRectIndex.byId,
      idsInRect: nodeRectIndex.nodeIdsInRect
    },
    snap: {
      all: snapIndex.all,
      inRect: snapIndex.queryInRect
    }
  }

  const projectionListeners: Record<ProjectionSubscriptionKey, Set<() => void>> = {
    [READ_KEYS.node]: new Set(),
    [READ_KEYS.edge]: new Set(),
    [READ_KEYS.mindmap]: new Set()
  }

  const publishProjection = (keys: readonly ProjectionSubscriptionKey[]) => {
    const notified = new Set<() => void>()

    keys.forEach((key) => {
      projectionListeners[key].forEach((listener) => {
        if (notified.has(listener)) return
        notified.add(listener)
        listener()
      })
    })
  }

  const subscribe: EngineRead['subscribe'] = (key, listener) => {
    if (key === READ_KEYS.viewport) {
      return document.subscribeViewport(listener)
    }

    return subscribeListener(projectionListeners[key], listener)
  }

  const readContext: ReadContext = {
    mindmapLayout,
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
    publish: publishProjection
  })

  nodeRectIndex.applyChange('full', [], readModel())
  snapIndex.applyChange('full', [], nodeRectIndex)

  return {
    read: {
      get viewport() { return readViewport() },
      get node() { return nodeProjection.getView() },
      get edge() { return edgeProjection.getView() },
      get mindmap() { return mindmapProjection.getView() },
      index: indexes,
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
