import type { ReadControl, ReadDeps, ReadModel } from '@engine-types/read'
import type { EngineReadIndex } from '@engine-types/instance'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import { DEFAULT_TUNING } from '../../config'
import { RESET_READ_IMPACT } from '../impacts'
import { NodeRectIndex, SnapIndex } from '../indexes'
import { createEdgeProjection } from './edge'
import { createReadModel } from './model'
import { createMindmapProjection } from './mindmap'
import { createNodeProjection } from './node'
import type { ReadSnapshot } from './types'

export const createRead = ({
  document,
  mindmapLayout,
  config
}: ReadDeps): ReadControl => {
  const readDocument = document.get
  const readModel = createReadModel({ readDocument })

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const indexes: EngineReadIndex = {
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

  const createSnapshot = (model: ReadModel): ReadSnapshot => ({
    model,
    indexes
  })

  const initialModel = readModel()
  const initialSnapshot = createSnapshot(initialModel)

  const nodeProjection = createNodeProjection(initialSnapshot)
  const edgeProjection = createEdgeProjection(initialSnapshot)
  const mindmapProjection = createMindmapProjection(initialSnapshot, {
    config,
    mindmapLayout
  })

  const applyImpact = (impact: KernelReadImpact) => {
    const model = readModel()
    nodeRectIndex.applyChange(impact, model)
    snapIndex.applyChange(impact, nodeRectIndex)
    const snapshot = createSnapshot(model)
    nodeProjection.applyChange(impact, snapshot)
    edgeProjection.applyChange(impact, snapshot)
    mindmapProjection.applyChange(impact, snapshot)
  }

  applyImpact(RESET_READ_IMPACT)

  return {
    read: {
      node: {
        ids: nodeProjection.ids,
        get: nodeProjection.get,
        subscribe: nodeProjection.subscribe,
        subscribeIds: nodeProjection.subscribeIds
      },
      edge: {
        ids: edgeProjection.ids,
        get: edgeProjection.get,
        subscribe: edgeProjection.subscribe,
        subscribeIds: edgeProjection.subscribeIds
      },
      mindmap: {
        ids: mindmapProjection.ids,
        get: mindmapProjection.get,
        subscribe: mindmapProjection.subscribe,
        subscribeIds: mindmapProjection.subscribeIds
      },
      index: indexes
    },
    invalidate: applyImpact
  }
}
