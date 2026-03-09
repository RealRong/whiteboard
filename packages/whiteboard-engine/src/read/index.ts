import type {
  ReadControl,
  ReadCommit,
  ReadContext,
  ReadDeps,
  ReadIndexes
} from '@engine-types/read'
import { DEFAULT_TUNING } from '../config'
import { createReadApply } from './apply'
import { MINDMAP_LAYOUT_READ_IMPACT, RESET_READ_IMPACT } from './impacts'
import { createReadModel } from './model'
import {
  createEdgeProjection,
  createMindmapProjection,
  createNodeProjection
} from './projection'
import { NodeRectIndex, SnapIndex } from './indexes'

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

  const applyImpact = createReadApply({
    readModel,
    nodeRectIndex,
    snapIndex,
    nodeProjection,
    edgeProjection,
    mindmapProjection
  })

  nodeRectIndex.applyChange('full', [], readModel())
  snapIndex.applyChange('full', [], nodeRectIndex)
  nodeProjection.applyChange(RESET_READ_IMPACT)
  edgeProjection.applyChange('full', [], [])
  mindmapProjection.applyChange(RESET_READ_IMPACT)

  const commit = (committed: ReadCommit) => {
    if (committed.kind === 'replace') {
      applyImpact(RESET_READ_IMPACT)
    } else {
      applyImpact(committed.impact)
    }
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
    commit,
    rebuildMindmap: () => applyImpact(MINDMAP_LAYOUT_READ_IMPACT)
  }
}
