import type {
  ReadControl,
  ReadContext,
  ReadDeps,
  ReadIndexes
} from '@engine-types/read'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import { DEFAULT_TUNING } from '../../config'
import { RESET_READ_IMPACT } from '../impacts'
import { NodeRectIndex, SnapIndex } from '../indexes'
import { createEdgeProjection } from './edge'
import { createReadModel } from './model'
import { createMindmapProjection } from './mindmap'
import { createNodeProjection } from './node'

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

  const readContext: ReadContext = {
    mindmapLayout,
    model: readModel,
    indexes,
    config
  }

  const nodeProjection = createNodeProjection(readContext)
  const edgeProjection = createEdgeProjection(readContext)
  const mindmapProjection = createMindmapProjection(readContext)

  const applyImpact = (impact: KernelReadImpact) => {
    const model = readModel()
    nodeRectIndex.applyChange(impact, model)
    snapIndex.applyChange(impact, nodeRectIndex)
    nodeProjection.applyChange(impact)
    edgeProjection.applyChange(impact)
    mindmapProjection.applyChange(impact)
  }

  const initialModel = readModel()
  nodeRectIndex.applyChange(RESET_READ_IMPACT, initialModel)
  snapIndex.applyChange(RESET_READ_IMPACT, nodeRectIndex)
  nodeProjection.applyChange(RESET_READ_IMPACT)
  edgeProjection.applyChange(RESET_READ_IMPACT)
  mindmapProjection.applyChange(RESET_READ_IMPACT)

  const invalidate = (impact: KernelReadImpact) => {
    applyImpact(impact)
  }

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
    invalidate
  }
}
